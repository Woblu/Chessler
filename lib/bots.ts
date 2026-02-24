export interface BotProfile {
  id: string
  name: string
  title: string
  elo: number
  depth: number
  description: string
  category: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master'
}

export const BOT_PROFILES: BotProfile[] = [
  {
    id: 'tommy-hayes',
    name: 'Tommy Hayes',
    title: 'The Wanderer',
    elo: 250,
    depth: 1,
    description: 'Just learning the rules. Makes random-looking moves and frequently misses hanging pieces.',
    category: 'beginner',
  },
  {
    id: 'dylan-park',
    name: 'Dylan Park',
    title: 'The Blunderer',
    elo: 500,
    depth: 2,
    description: 'Knows how all the pieces move but regularly overlooks tactics. Occasionally gets lucky.',
    category: 'beginner',
  },
  {
    id: 'marcus-webb',
    name: 'Marcus Webb',
    title: 'The Amateur',
    elo: 800,
    depth: 3,
    description: 'A club beginner with some opening knowledge. Will fight back but blunders under pressure.',
    category: 'beginner',
  },
  {
    id: 'claire-foster',
    name: 'Claire Foster',
    title: 'The Club Player',
    elo: 1100,
    depth: 5,
    description: "Plays reasonable chess with decent tactics. Knows a handful of openings and won't hang pieces for free.",
    category: 'intermediate',
  },
  {
    id: 'james-reeves',
    name: 'James Reeves',
    title: 'The Positional Player',
    elo: 1400,
    depth: 7,
    description: 'Strong positional understanding and consistent play. Punishes structural weaknesses methodically.',
    category: 'intermediate',
  },
  {
    id: 'sofia-barros',
    name: 'Sofia Barros',
    title: 'The Tactician',
    elo: 1700,
    depth: 9,
    description: 'Sharp tactical vision and attacking instincts. One careless move and the game is over.',
    category: 'advanced',
  },
  {
    id: 'henrik-larsen',
    name: 'Henrik Larsen',
    title: 'The Expert',
    elo: 2000,
    depth: 12,
    description: 'Expert-level precision. Controls the board, exploits every weakness, and converts endgames flawlessly.',
    category: 'expert',
  },
  {
    id: 'nadia-volkov',
    name: 'Nadia Volkov',
    title: 'The National Master',
    elo: 2300,
    depth: 15,
    description: 'Master-strength in all phases. Dangerous in complex positions and ice-cold in the endgame.',
    category: 'expert',
  },
  {
    id: 'arjun-mehta',
    name: 'Arjun Mehta',
    title: 'The Grandmaster',
    elo: 2700,
    depth: 18,
    description: 'Near-perfect chess. Finds the best moves in any position and dismantles even solid defences.',
    category: 'master',
  },
  {
    id: 'viktor-kashin',
    name: 'Viktor Kashin',
    title: 'The Machine',
    elo: 3200,
    depth: 20,
    description: 'Calculates 20 moves deep without mercy. No human has ever beaten him at full strength.',
    category: 'master',
  },
]

// Minimum ELO that Stockfish can simulate via UCI_LimitStrength
const SF_ELO_MIN = 1320

/**
 * Sets the Stockfish engine difficulty based on bot ELO.
 * For bots below Stockfish's minimum ELO floor, Skill Level is used instead.
 */
export function setEngineDifficulty(
  sendCommand: (command: string) => void,
  bot: Pick<BotProfile, 'elo' | 'depth'>
): void {
  if (bot.elo >= SF_ELO_MIN) {
    sendCommand('setoption name UCI_LimitStrength value true')
    sendCommand(`setoption name UCI_Elo value ${bot.elo}`)
  } else {
    // Map ELO 250–1319 → Skill Level 0–5
    sendCommand('setoption name UCI_LimitStrength value false')
    const skillLevel = Math.max(0, Math.round((bot.elo / SF_ELO_MIN) * 5))
    sendCommand(`setoption name Skill Level value ${skillLevel}`)
  }
  sendCommand('isready')
}

/** Returns a human-readable title for any ELO value — used for tournament bots. */
export function getBotTitleByElo(elo: number): string {
  if (elo < 600) return 'Novice'
  if (elo < 900) return 'Amateur'
  if (elo < 1200) return 'Club Player'
  if (elo < 1500) return 'Intermediate'
  if (elo < 1800) return 'Advanced'
  if (elo < 2000) return 'Expert'
  if (elo < 2200) return 'Candidate Master'
  if (elo < 2500) return 'International Master'
  if (elo < 2700) return 'Grandmaster'
  return 'Super Grandmaster'
}

/** Returns a category label for a given ELO. */
export function getBotCategoryByElo(elo: number): BotProfile['category'] {
  if (elo < 600) return 'beginner'
  if (elo < 1200) return 'intermediate'
  if (elo < 1800) return 'advanced'
  if (elo < 2400) return 'expert'
  return 'master'
}
