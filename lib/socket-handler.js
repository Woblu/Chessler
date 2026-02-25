const { Chess } = require('chess.js')
const { PrismaClient } = require('@prisma/client')
const { processGameResult } = require('./ranking')

const prisma = new PrismaClient()

// ─── In-memory state ──────────────────────────────────────────────────────────

/** gameId → GameState */
const activeGames = new Map()

/** socketId → { gameId, playerId, color } */
const socketToPlayer = new Map()

/** playerId → socketId  (only for players inside active games) */
const playerToSocket = new Map()

/** socketId → queue entry */
const socketToQueueEntry = new Map()

/** Ordered matchmaking queue */
const matchmakingQueue = []

// ─── Game state factory ───────────────────────────────────────────────────────

function createGameState(gameId, whitePlayerId, blackPlayerId, timeControl) {
  const initialMs = timeControl.initial > 0 ? timeControl.initial * 1000 : -1
  return {
    chess: new Chess(),
    gameId,
    whitePlayerId,
    blackPlayerId,
    currentTurn: 'w',
    gameOver: false,
    result: null,
    // Clocks (-1 = unlimited)
    whiteTimeMs: initialMs,
    blackTimeMs: initialMs,
    increment: timeControl.increment || 0,
    lastMoveAt: null,
    flagFallTimer: null,
    // Connection tracking
    connectedPlayers: new Map(),   // playerId → socketId
    disconnectTimers: new Map(),   // playerId → timeout handle
    // Draw-offer state
    drawOfferedBy: null,
  }
}

// ─── Clock helpers ────────────────────────────────────────────────────────────

/**
 * Returns live-adjusted times for both clocks accounting for any
 * time already elapsed on the current player's turn.
 */
function getLiveTimes(gs) {
  if (gs.whiteTimeMs === -1) return { whiteTimeMs: -1, blackTimeMs: -1 }
  if (!gs.lastMoveAt || gs.gameOver) {
    return { whiteTimeMs: gs.whiteTimeMs, blackTimeMs: gs.blackTimeMs }
  }
  const elapsed = Date.now() - gs.lastMoveAt
  if (gs.currentTurn === 'w') {
    return { whiteTimeMs: Math.max(0, gs.whiteTimeMs - elapsed), blackTimeMs: gs.blackTimeMs }
  } else {
    return { whiteTimeMs: gs.whiteTimeMs, blackTimeMs: Math.max(0, gs.blackTimeMs - elapsed) }
  }
}

function startFlagFallTimer(io, gameId) {
  const gs = activeGames.get(gameId)
  if (!gs || gs.gameOver || gs.whiteTimeMs === -1) return

  if (gs.flagFallTimer) clearTimeout(gs.flagFallTimer)

  const remainingMs = gs.currentTurn === 'w' ? gs.whiteTimeMs : gs.blackTimeMs
  if (remainingMs <= 0) return

  gs.flagFallTimer = setTimeout(async () => {
    const gs = activeGames.get(gameId)
    if (!gs || gs.gameOver) return
    const isDraw = gs.chess.isInsufficientMaterial()
    const result = isDraw ? 'DRAW'
      : gs.currentTurn === 'w' ? 'BLACK_WIN' : 'WHITE_WIN'
    await endGame(io, gameId, result, 'timeout')
  }, remainingMs)
}

// ─── End-game helper ──────────────────────────────────────────────────────────

async function endGame(io, gameId, result, reason) {
  const gs = activeGames.get(gameId)
  if (!gs || gs.gameOver) return

  gs.gameOver = true
  gs.result = result
  if (gs.flagFallTimer) { clearTimeout(gs.flagFallTimer); gs.flagFallTimer = null }
  // Cancel any pending disconnect forfeits
  gs.disconnectTimers.forEach((t) => clearTimeout(t))
  gs.disconnectTimers.clear()

  const uciMoves = gs.chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''))

  try {
    await prisma.game.update({
      where: { id: gameId },
      data: { result, moves: uciMoves.join(' ') },
    })
    await processGameResult(gameId)
  } catch (err) {
    console.error('[endGame] DB error:', err)
  }

  const { whiteTimeMs, blackTimeMs } = getLiveTimes(gs)
  io.to(gameId).emit('game_over', { result, reason, fen: gs.chess.fen(), whiteTimeMs, blackTimeMs })

  setTimeout(() => activeGames.delete(gameId), 120_000)
}

// ─── Matchmaking ──────────────────────────────────────────────────────────────

/**
 * Score-based match finder. Higher = better match.
 * Score decays with MMR gap but improves with wait time so players
 * eventually get matched regardless of MMR difference.
 */
function findBestMatch(newEntry) {
  const now = Date.now()
  let best = null
  let bestScore = -Infinity

  for (const c of matchmakingQueue) {
    if (c.playerId === newEntry.playerId) continue

    const waitSec  = (now - c.joinedAt) / 1000
    const mySec    = (now - newEntry.joinedAt) / 1000
    const minWait  = Math.min(waitSec, mySec)
    const mmrDiff  = Math.abs(c.mmr - newEntry.mmr)
    const sameTC   = c.timeControl.initial === newEntry.timeControl.initial

    let score = 0
    if (sameTC) score += 100
    score -= mmrDiff / 50       // −1 per 50 MMR gap
    score += minWait * 2        // +2 per second waiting

    // Rising acceptance threshold: strict at first, open after 60 s
    const threshold = minWait > 60 ? -Infinity : minWait > 30 ? 0 : 50

    if (score > threshold && score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

function removeFromQueue(entry) {
  const idx = matchmakingQueue.findIndex((e) => e.socketId === entry.socketId)
  if (idx !== -1) matchmakingQueue.splice(idx, 1)
  socketToQueueEntry.delete(entry.socketId)
}

// ─── Main socket handler ──────────────────────────────────────────────────────

module.exports = function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log('[socket] +', socket.id)

    // ── join_game ──────────────────────────────────────────────────────────────
    socket.on('join_game', async ({ gameId, playerId }) => {
      try {
        if (!gameId || !playerId) {
          socket.emit('error', { message: 'gameId and playerId are required' })
          return
        }

        const game = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            whitePlayer: { select: { id: true, name: true, rating: true } },
            blackPlayer: { select: { id: true, name: true, rating: true } },
          },
        })

        if (!game)         { socket.emit('error', { message: 'Game not found' }); return }
        if (game.result)   { socket.emit('error', { message: 'This game has already finished' }); return }

        const color = game.whitePlayerId === playerId ? 'white'
          : game.blackPlayerId === playerId ? 'black' : null
        if (!color) { socket.emit('error', { message: 'You are not a player in this game' }); return }

        let gs = activeGames.get(gameId)
        if (!gs) {
          // Fallback: create state with default time if the matchmaking entry was lost
          gs = createGameState(gameId, game.whitePlayerId, game.blackPlayerId, { initial: 600, increment: 0 })
          activeGames.set(gameId, gs)
        }

        // Cancel any pending disconnect forfeit for this player
        const existingTimer = gs.disconnectTimers.get(playerId)
        if (existingTimer) {
          clearTimeout(existingTimer)
          gs.disconnectTimers.delete(playerId)
          socket.to(gameId).emit('opponent_reconnected', { color })
        }

        // Update connection maps
        const oldSid = gs.connectedPlayers.get(playerId)
        if (oldSid && oldSid !== socket.id) socketToPlayer.delete(oldSid)

        gs.connectedPlayers.set(playerId, socket.id)
        playerToSocket.set(playerId, socket.id)
        socketToPlayer.set(socket.id, { gameId, playerId, color })
        socket.join(gameId)

        const { whiteTimeMs, blackTimeMs } = getLiveTimes(gs)

        socket.emit('game_state', {
          fen: gs.chess.fen(),
          currentTurn: gs.currentTurn,
          gameOver: gs.gameOver,
          result: gs.result,
          yourColor: color,
          whitePlayer: { id: game.whitePlayer.id, name: game.whitePlayer.name, rating: game.whitePlayer.rating },
          blackPlayer: { id: game.blackPlayer.id, name: game.blackPlayer.name, rating: game.blackPlayer.rating },
          whiteTimeMs,
          blackTimeMs,
          increment: gs.increment,
          moves: gs.chess.history(),
        })

        // Restart flag-fall timer if game is already in progress
        if (gs.lastMoveAt && !gs.gameOver) startFlagFallTimer(io, gameId)

      } catch (err) {
        console.error('[join_game]', err)
        socket.emit('error', { message: 'Failed to join game' })
      }
    })

    // ── make_move ──────────────────────────────────────────────────────────────
    socket.on('make_move', async ({ from, to, promotion }) => {
      try {
        const info = socketToPlayer.get(socket.id)
        if (!info) { socket.emit('error', { message: 'Not in a game' }); return }

        const { gameId, color } = info
        const gs = activeGames.get(gameId)
        if (!gs)          { socket.emit('error', { message: 'Game not found' }); return }
        if (gs.gameOver)  { socket.emit('error', { message: 'Game is over' });   return }

        const expectedColor = gs.currentTurn === 'w' ? 'white' : 'black'
        if (color !== expectedColor) { socket.emit('error', { message: 'Not your turn' }); return }

        const move = gs.chess.move({ from, to, promotion: promotion || 'q' })
        if (!move) { socket.emit('error', { message: 'Invalid move' }); return }

        // ── Clock update ───────────────────────────────────────────────────────
        if (gs.flagFallTimer) { clearTimeout(gs.flagFallTimer); gs.flagFallTimer = null }

        if (gs.lastMoveAt !== null && gs.whiteTimeMs !== -1) {
          const elapsed = Date.now() - gs.lastMoveAt
          if (color === 'white') {
            gs.whiteTimeMs = Math.max(0, gs.whiteTimeMs - elapsed) + gs.increment * 1000
          } else {
            gs.blackTimeMs = Math.max(0, gs.blackTimeMs - elapsed) + gs.increment * 1000
          }
        }
        gs.lastMoveAt  = Date.now()
        gs.drawOfferedBy = null  // any move cancels pending draw offer
        gs.currentTurn   = gs.chess.turn()

        // ── Check for game end ─────────────────────────────────────────────────
        let gameOverResult = null
        if      (gs.chess.isCheckmate())                   gameOverResult = gs.currentTurn === 'w' ? 'BLACK_WIN' : 'WHITE_WIN'
        else if (gs.chess.isDraw() || gs.chess.isStalemate()) gameOverResult = 'DRAW'

        io.to(gameId).emit('move_made', {
          from: move.from,
          to:   move.to,
          san:  move.san,
          fen:  gs.chess.fen(),
          currentTurn: gs.currentTurn,
          whiteTimeMs: gs.whiteTimeMs,
          blackTimeMs: gs.blackTimeMs,
          gameOver: !!gameOverResult,
          result:   gameOverResult,
          isCheck:  gs.chess.isCheck(),
        })

        if (gameOverResult) await endGame(io, gameId, gameOverResult, 'checkmate')
        else                startFlagFallTimer(io, gameId)

      } catch (err) {
        console.error('[make_move]', err)
        socket.emit('error', { message: 'Failed to make move' })
      }
    })

    // ── resign ─────────────────────────────────────────────────────────────────
    socket.on('resign', async () => {
      const info = socketToPlayer.get(socket.id)
      if (!info) return
      const gs = activeGames.get(info.gameId)
      if (!gs || gs.gameOver) return
      const result = info.color === 'white' ? 'BLACK_WIN' : 'WHITE_WIN'
      await endGame(io, info.gameId, result, 'resign')
    })

    // ── offer_draw ─────────────────────────────────────────────────────────────
    socket.on('offer_draw', () => {
      const info = socketToPlayer.get(socket.id)
      if (!info) return
      const gs = activeGames.get(info.gameId)
      if (!gs || gs.gameOver) return
      if (!gs.drawOfferedBy) {
        gs.drawOfferedBy = info.color
        socket.to(info.gameId).emit('draw_offered', { by: info.color })
        socket.emit('draw_offer_sent')
      }
    })

    // ── accept_draw ────────────────────────────────────────────────────────────
    socket.on('accept_draw', async () => {
      const info = socketToPlayer.get(socket.id)
      if (!info) return
      const gs = activeGames.get(info.gameId)
      if (!gs || gs.gameOver) return
      if (gs.drawOfferedBy && gs.drawOfferedBy !== info.color) {
        await endGame(io, info.gameId, 'DRAW', 'agreement')
      }
    })

    // ── decline_draw ───────────────────────────────────────────────────────────
    socket.on('decline_draw', () => {
      const info = socketToPlayer.get(socket.id)
      if (!info) return
      const gs = activeGames.get(info.gameId)
      if (!gs) return
      if (gs.drawOfferedBy) {
        gs.drawOfferedBy = null
        socket.to(info.gameId).emit('draw_declined')
      }
    })

    // ── join_queue ─────────────────────────────────────────────────────────────
    socket.on('join_queue', async ({ playerId, name, mmr, timeControl }) => {
      try {
        if (!playerId) { socket.emit('error', { message: 'playerId required' }); return }

        // Remove any stale queue entry for this socket
        const stale = socketToQueueEntry.get(socket.id)
        if (stale) removeFromQueue(stale)

        const tc    = timeControl || { initial: 600, increment: 0 }
        const entry = { playerId, name: name || 'Player', mmr: mmr || 0, socketId: socket.id, timeControl: tc, joinedAt: Date.now() }

        matchmakingQueue.push(entry)
        socketToQueueEntry.set(socket.id, entry)

        socket.emit('queue_status', { inQueue: true, message: 'Searching for opponent…', queueSize: matchmakingQueue.length })
        console.log(`[queue] ${name} (${mmr} MMR, ${tc.initial}+${tc.increment}) joined — size: ${matchmakingQueue.length}`)

        // Try to pair immediately
        const opponent = findBestMatch(entry)
        if (opponent) {
          removeFromQueue(entry)
          removeFromQueue(opponent)

          const matchTc        = entry.timeControl.initial > 0 ? entry.timeControl : opponent.timeControl
          const newIsWhite     = Math.random() > 0.5
          const whitePlayerId  = newIsWhite ? entry.playerId    : opponent.playerId
          const blackPlayerId  = newIsWhite ? opponent.playerId : entry.playerId

          const game = await prisma.game.create({
            data: { whitePlayerId, blackPlayerId, result: null, isOnline: true },
          })

          // Pre-create game state so clocks are ready when clients join
          const gs = createGameState(game.id, whitePlayerId, blackPlayerId, matchTc)
          activeGames.set(game.id, gs)

          console.log(`[queue] matched ${entry.name} vs ${opponent.name} → game ${game.id}`)

          io.to(entry.socketId).emit('match_found', {
            gameId: game.id,
            opponentName: opponent.name,
            opponentMmr:  opponent.mmr,
            color:        newIsWhite ? 'white' : 'black',
            timeControl:  matchTc,
          })
          io.to(opponent.socketId).emit('match_found', {
            gameId: game.id,
            opponentName: entry.name,
            opponentMmr:  entry.mmr,
            color:        newIsWhite ? 'black' : 'white',
            timeControl:  matchTc,
          })
        }
      } catch (err) {
        console.error('[join_queue]', err)
        socket.emit('error', { message: 'Failed to join queue' })
      }
    })

    // ── leave_queue ────────────────────────────────────────────────────────────
    socket.on('leave_queue', () => {
      const entry = socketToQueueEntry.get(socket.id)
      if (entry) {
        removeFromQueue(entry)
        socket.emit('queue_status', { inQueue: false, message: '' })
      }
    })

    // ── disconnect ─────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log('[socket] -', socket.id)

      // Remove from matchmaking queue
      const qEntry = socketToQueueEntry.get(socket.id)
      if (qEntry) removeFromQueue(qEntry)

      // Handle active game disconnect
      const info = socketToPlayer.get(socket.id)
      if (info) {
        const { gameId, playerId, color } = info
        const gs = activeGames.get(gameId)

        if (gs && !gs.gameOver) {
          socket.to(gameId).emit('opponent_disconnected', { color, secondsLeft: 60 })

          // 60-second reconnection window
          const timer = setTimeout(async () => {
            const gs = activeGames.get(gameId)
            if (!gs || gs.gameOver) return
            // Only forfeit if still on old socket (didn't reconnect)
            if (gs.connectedPlayers.get(playerId) === socket.id) {
              const result = color === 'white' ? 'BLACK_WIN' : 'WHITE_WIN'
              await endGame(io, gameId, result, 'abandonment')
            }
          }, 60_000)

          gs.disconnectTimers.set(playerId, timer)
        }

        socketToPlayer.delete(socket.id)
        playerToSocket.delete(playerId)
        if (gs) gs.connectedPlayers.delete(playerId)
      }
    })
  })

  // Periodic queue size broadcast so clients can show live wait info
  setInterval(() => {
    if (matchmakingQueue.length === 0) return
    const now = Date.now()
    matchmakingQueue.forEach((entry) => {
      const waitSeconds = Math.floor((now - entry.joinedAt) / 1000)
      io.to(entry.socketId).emit('queue_status', {
        inQueue:     true,
        message:     'Searching for opponent…',
        queueSize:   matchmakingQueue.length,
        waitSeconds,
      })
    })
  }, 5_000)
}
