import { Glicko2 } from 'glicko2'

export interface Glicko2PlayerState {
  rating: number
  ratingDeviation: number
  volatility: number
}

export interface Glicko2Result {
  player1: Glicko2PlayerState
  player2: Glicko2PlayerState
}

const DEFAULT_RATING = 1200
const DEFAULT_RD = 350
const DEFAULT_VOL = 0.06

/**
 * Calculate new Glicko-2 ratings after a single match.
 * @param player1 - Current rating, RD, and volatility for player 1 (e.g. white)
 * @param player2 - Current rating, RD, and volatility for player 2 (e.g. black)
 * @param result - Match result from player1's perspective: 1 = player1 win, 0 = player2 win, 0.5 = draw
 * @returns New rating, ratingDeviation, and volatility for both players
 */
export function calculateNewRatings(
  player1: Glicko2PlayerState,
  player2: Glicko2PlayerState,
  result: number
): Glicko2Result {
  const ranking = new Glicko2({
    tau: 0.5,
    rating: DEFAULT_RATING,
    rd: DEFAULT_RD,
    vol: DEFAULT_VOL,
  })

  const p1 = ranking.makePlayer(
    player1.rating,
    player1.ratingDeviation,
    player1.volatility
  )
  const p2 = ranking.makePlayer(
    player2.rating,
    player2.ratingDeviation,
    player2.volatility
  )

  ranking.updateRatings([[p1, p2, result]])

  return {
    player1: {
      rating: p1.getRating(),
      ratingDeviation: p1.getRd(),
      volatility: p1.getVol(),
    },
    player2: {
      rating: p2.getRating(),
      ratingDeviation: p2.getRd(),
      volatility: p2.getVol(),
    },
  }
}
