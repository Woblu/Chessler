import { PrismaClient } from '@prisma/client'
import { Chess } from 'chess.js'
import https from 'https'
import http from 'http'

const prisma = new PrismaClient()

interface LichessMove {
  uci: string
  san: string
  white: number
  black: number
  draws: number
}

interface LichessResponse {
  moves: LichessMove[]
  topGames?: any[]
  recentGames?: any[]
}

interface OpeningConfig {
  name: string
  ecoCode: string
  startingFen: string
  maxDepth: number
  movesPerPosition: number
}

const OPENING_CONFIGS: OpeningConfig[] = [
  {
    name: 'Ponziani Opening',
    ecoCode: 'C44',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    maxDepth: 15,
    movesPerPosition: 3,
  },
  {
    name: 'Italian Game',
    ecoCode: 'C50',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    maxDepth: 15,
    movesPerPosition: 3,
  },
  {
    name: 'Ruy Lopez',
    ecoCode: 'C60',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    maxDepth: 15,
    movesPerPosition: 3,
  },
]

async function fetchLichessMoves(fen: string): Promise<LichessMove[]> {
  return new Promise((resolve, reject) => {
    const encodedFen = encodeURIComponent(fen)
    const url = `https://explorer.lichess.ovh/masters?fen=${encodedFen}`

    const client = url.startsWith('https') ? https : http

    const req = client.get(url, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        // Lichess occasionally returns HTML (rate limit / upstream error / captive portal)
        // which would otherwise spam JSON.parse errors during long runs.
        const ct = String(res.headers['content-type'] ?? '').toLowerCase()
        const looksLikeHtml = data.trimStart().startsWith('<')
        if (looksLikeHtml || (ct && !ct.includes('application/json'))) {
          console.warn(
            `⚠️  Lichess explorer returned non-JSON (status ${res.statusCode}). Skipping this position.`
          )
          resolve([])
          return
        }
        try {
          const parsed: LichessResponse = JSON.parse(data)
          resolve(parsed.moves || [])
        } catch (error) {
          console.warn('⚠️  Error parsing Lichess response. Skipping this position.')
          resolve([])
        }
      })
    })

    req.on('error', (error) => {
      console.error('Error fetching from Lichess:', error)
      resolve([])
    })

    req.setTimeout(10000, () => {
      req.destroy()
      resolve([])
    })
  })
}

function calculatePopularityScore(move: LichessMove): number {
  // Combine total games (white + black + draws) as popularity score
  return move.white + move.black + move.draws
}

async function buildMoveNode(
  openingId: string,
  fen: string,
  parentNodeId: string | null,
  depth: number,
  maxDepth: number,
  movesPerPosition: number,
  isMainLine: boolean = false
): Promise<string | null> {
  if (depth >= maxDepth) {
    return null
  }

  // Fetch moves from Lichess
  console.log(`  ${'  '.repeat(depth)}Fetching moves for depth ${depth}...`)
  const moves = await fetchLichessMoves(fen)

  if (moves.length === 0) {
    console.log(`  ${'  '.repeat(depth)}No moves found at depth ${depth}`)
    return null
  }

  // Sort by popularity and take top N moves
  const topMoves = moves
    .map((move) => ({
      ...move,
      popularity: calculatePopularityScore(move),
    }))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, movesPerPosition)

  console.log(`  ${'  '.repeat(depth)}Found ${topMoves.length} moves (top ${movesPerPosition} of ${moves.length})`)

  const chess = new Chess(fen)
  let mainLineNodeId: string | null = null

  for (let i = 0; i < topMoves.length; i++) {
    const moveData = topMoves[i]
    const isMain = isMainLine && i === 0

    try {
      // Make the move to get the resulting position
      const move = chess.move({
        from: moveData.uci.substring(0, 2),
        to: moveData.uci.substring(2, 4),
        promotion: moveData.uci.length > 4 ? moveData.uci[4] : undefined,
      })

      if (!move) {
        console.log(`  ${'  '.repeat(depth)}Invalid move: ${moveData.uci}`)
        continue
      }

      const newFen = chess.fen()

      // Check if this node already exists
      const existingNode = await prisma.moveNode.findFirst({
        where: {
          openingId,
          fen: newFen,
          uciMove: moveData.uci,
          parentNodeId,
        },
      })

      let nodeId: string

      if (existingNode) {
        // Update popularity score if higher
        if (moveData.popularity > existingNode.popularityScore) {
          await prisma.moveNode.update({
            where: { id: existingNode.id },
            data: {
              popularityScore: moveData.popularity,
              isMainLine: existingNode.isMainLine || isMain,
            },
          })
        }
        nodeId = existingNode.id
        console.log(`  ${'  '.repeat(depth)}Node exists: ${moveData.san} (${moveData.popularity} games)`)
      } else {
        // Create new node
        const newNode = await prisma.moveNode.create({
          data: {
            openingId,
            fen: newFen,
            uciMove: moveData.uci,
            sanMove: moveData.san,
            parentNodeId,
            popularityScore: moveData.popularity,
            isMainLine: isMain,
          },
        })
        nodeId = newNode.id
        console.log(`  ${'  '.repeat(depth)}Created: ${moveData.san} (${moveData.popularity} games)${isMain ? ' [MAIN LINE]' : ''}`)
      }

      // Track main line node
      if (isMain) {
        mainLineNodeId = nodeId
      }

      // Recursively build child nodes (only for main line to avoid exponential growth)
      if (isMain || depth < 3) {
        await buildMoveNode(
          openingId,
          newFen,
          nodeId,
          depth + 1,
          maxDepth,
          movesPerPosition,
          isMain
        )
      }

      // Undo move for next iteration
      chess.undo()
    } catch (error) {
      console.error(`  ${'  '.repeat(depth)}Error processing move ${moveData.uci}:`, error)
      continue
    }

    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return mainLineNodeId
}

async function buildOpeningTree(config: OpeningConfig) {
  console.log(`\nBuilding tree for ${config.name} (${config.ecoCode})...`)

  // Check if opening exists, create if not
  let opening = await prisma.opening.findUnique({
    where: { ecoCode: config.ecoCode },
  })

  if (!opening) {
    opening = await prisma.opening.create({
      data: {
        name: config.name,
        ecoCode: config.ecoCode,
      },
    })
    console.log(`Created opening: ${config.name}`)
  } else {
    console.log(`Opening already exists: ${config.name}`)
    // Optionally clear existing nodes to rebuild
    // await prisma.moveNode.deleteMany({ where: { openingId: opening.id } })
  }

  // Build the tree starting from the initial position
  console.log(`Starting from FEN: ${config.startingFen}`)
  console.log(`Max depth: ${config.maxDepth}, Moves per position: ${config.movesPerPosition}`)

  await buildMoveNode(
    opening.id,
    config.startingFen,
    null,
    0,
    config.maxDepth,
    config.movesPerPosition,
    true
  )

  console.log(`✓ Completed building tree for ${config.name}`)
}

async function main() {
  console.log('Starting opening tree builder...\n')

  for (const config of OPENING_CONFIGS) {
    try {
      await buildOpeningTree(config)
      // Add delay between openings
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`Error building tree for ${config.name}:`, error)
    }
  }

  console.log('\n✓ All opening trees built!')
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
