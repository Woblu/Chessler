type PendingKind = 'bestmove' | 'eval' | null

export interface Evaluation {
  score: number
  isMate: boolean
  mateIn: number | null
}

export interface StockfishStateSnapshot {
  isReady: boolean
  isThinking: boolean
  error: string | null
}

type Listener = (s: StockfishStateSnapshot) => void

interface Engine {
  worker: Worker
  state: StockfishStateSnapshot
  isBusy: boolean
  pendingKind: PendingKind
  pendingMove: ((v: string | null) => void) | null
  pendingEval: ((v: Evaluation | null) => void) | null
  accumEval: Evaluation | null
  readyTimeout: ReturnType<typeof setTimeout> | null
  listeners: Set<Listener>
}

let engineSingleton: Engine | null = null

function emit(engine: Engine) {
  const snap = engine.state
  engine.listeners.forEach((l) => l(snap))
}

function setState(engine: Engine, next: Partial<StockfishStateSnapshot>) {
  engine.state = { ...engine.state, ...next }
  emit(engine)
}

function clearReadyTimeout(engine: Engine) {
  if (engine.readyTimeout) {
    clearTimeout(engine.readyTimeout)
    engine.readyTimeout = null
  }
}

function abortCurrent(engine: Engine) {
  if (engine.isBusy) {
    engine.worker.postMessage('stop')
  }
  engine.pendingMove?.(null)
  engine.pendingEval?.(null)
  engine.pendingMove = null
  engine.pendingEval = null
  engine.pendingKind = null
  engine.accumEval = null
  engine.isBusy = false
  setState(engine, { isThinking: false })
}

function initEngine(): Engine {
  const worker = new Worker('/stockfish.js')

  const engine: Engine = {
    worker,
    state: { isReady: false, isThinking: false, error: null },
    isBusy: false,
    pendingKind: null,
    pendingMove: null,
    pendingEval: null,
    accumEval: null,
    readyTimeout: null,
    listeners: new Set(),
  }

  // If engine doesn't respond within 12s (e.g. worker 404), stop blocking the UI.
  engine.readyTimeout = setTimeout(() => {
    if (engine.state.isReady) return
    setState(engine, {
      error: 'Engine failed to load. Refresh the page or try another browser.',
      isReady: true,
    })
  }, 12000)

  worker.onmessage = (e: MessageEvent<string>) => {
    const msg = e.data.trim()

    if (msg === 'uciok' || msg.includes('readyok')) {
      clearReadyTimeout(engine)
      setState(engine, { isReady: true, error: null })
      return
    }

    if (msg.startsWith('info')) {
      const cpMatch = msg.match(/score cp (-?\d+)/)
      const mateMatch = msg.match(/score mate (-?\d+)/)
      if (cpMatch) {
        engine.accumEval = { score: parseInt(cpMatch[1]), isMate: false, mateIn: null }
      } else if (mateMatch) {
        const mv = parseInt(mateMatch[1])
        engine.accumEval = { score: mv > 0 ? 10000 : -10000, isMate: true, mateIn: mv }
      }
      return
    }

    if (msg.startsWith('bestmove')) {
      engine.isBusy = false
      setState(engine, { isThinking: false })

      const bm = msg.split(' ')[1]
      const bestMove = bm && bm !== '(none)' ? bm : null

      if (engine.pendingKind === 'bestmove' && engine.pendingMove) {
        engine.pendingMove(bestMove)
        engine.pendingMove = null
      }
      if (engine.pendingKind === 'eval' && engine.pendingEval) {
        engine.pendingEval(engine.accumEval)
        engine.pendingEval = null
      }

      engine.pendingKind = null
      engine.accumEval = null
      return
    }

    if (msg.toLowerCase().includes('error')) {
      setState(engine, { error: msg })
      abortCurrent(engine)
    }
  }

  worker.onerror = (err) => {
    clearReadyTimeout(engine)
    console.error('Stockfish worker error:', err)
    setState(engine, { error: 'Stockfish worker error', isReady: true, isThinking: false })
    abortCurrent(engine)
  }

  worker.postMessage('uci')
  worker.postMessage('isready')

  return engine
}

export function ensureStockfishEngine() {
  if (engineSingleton) return engineSingleton
  engineSingleton = initEngine()
  return engineSingleton
}

export function subscribeStockfish(listener: Listener) {
  const engine = ensureStockfishEngine()
  engine.listeners.add(listener)
  listener(engine.state)
  return () => {
    engine.listeners.delete(listener)
  }
}

export function getStockfishSnapshot(): StockfishStateSnapshot {
  const engine = ensureStockfishEngine()
  return engine.state
}

export function sendStockfishCommand(command: string) {
  const engine = ensureStockfishEngine()
  if (!engine.state.isReady) return
  engine.worker.postMessage(command)
}

export function getStockfishBestMove(fen: string, depth: number, moveTimeMs?: number): Promise<string | null> {
  const engine = ensureStockfishEngine()

  return new Promise((resolve) => {
    if (!engine.state.isReady) {
      resolve(null)
      return
    }

    abortCurrent(engine)
    engine.isBusy = true
    engine.pendingKind = 'bestmove'
    engine.pendingMove = resolve
    engine.accumEval = null
    setState(engine, { isThinking: true, error: null })

    engine.worker.postMessage(`position fen ${fen}`)
    if (moveTimeMs) engine.worker.postMessage(`go depth ${depth} movetime ${moveTimeMs}`)
    else engine.worker.postMessage(`go depth ${depth}`)

    const deadline = (moveTimeMs ?? 12000) + 3000
    setTimeout(() => {
      if (engine.pendingMove === resolve) {
        abortCurrent(engine)
        resolve(null)
      }
    }, deadline)
  })
}

export function getStockfishEvaluation(fen: string, depth: number): Promise<Evaluation | null> {
  const engine = ensureStockfishEngine()

  return new Promise((resolve) => {
    if (!engine.state.isReady) {
      resolve(null)
      return
    }

    // Don’t interrupt a bot best-move search.
    if (engine.isBusy && engine.pendingKind === 'bestmove') {
      resolve(null)
      return
    }

    abortCurrent(engine)
    engine.isBusy = true
    engine.pendingKind = 'eval'
    engine.pendingEval = resolve
    engine.accumEval = null

    engine.worker.postMessage(`position fen ${fen}`)
    engine.worker.postMessage(`go depth ${depth} movetime 2000`)

    setTimeout(() => {
      if (engine.pendingEval === resolve) {
        engine.pendingEval = null
        engine.isBusy = false
        engine.pendingKind = null
        resolve(engine.accumEval)
        engine.accumEval = null
      }
    }, 5000)
  })
}

