import { PrismaClient } from '@prisma/client'
import { Chess } from 'chess.js'

const prisma = new PrismaClient()

// Predefined opening lines with PGN sequences
const OPENING_LINES: Array<{ code: string; name: string; pgn: string }> = [
  { code: 'C44', name: 'Ponziani Opening', pgn: 'e4 e5 Nf3 Nc6 c3' },
  { code: 'C50', name: 'Italian Game', pgn: 'e4 e5 Nf3 Nc6 Bc4 Bc5' },
  { code: 'C60', name: 'Ruy Lopez', pgn: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6' },
  { code: 'B20', name: 'Sicilian Defense', pgn: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6' },
  { code: 'C00', name: 'French Defense', pgn: 'e4 e6 d4 d5 Nc3 Bb4' },
  { code: 'C30', name: 'King\'s Gambit', pgn: 'e4 e5 f4 exf4 Nf3 g5' },
  { code: 'D20', name: 'Queen\'s Gambit Accepted', pgn: 'd4 d5 c4 dxc4 e3 b5' },
  { code: 'D30', name: 'Queen\'s Gambit Declined', pgn: 'd4 d5 c4 e6 Nc3 Nf6' },
  { code: 'E60', name: 'King\'s Indian Defense', pgn: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6' },
  { code: 'A20', name: 'English Opening', pgn: 'c4 e5 Nc3 Nf6 g3 d5' },
  { code: 'E00', name: 'Catalan Opening', pgn: 'd4 Nf6 c4 e6 g3 d5 Bg2' },
  { code: 'E20', name: 'Nimzo-Indian Defense', pgn: 'd4 Nf6 c4 e6 Nc3 Bb4' },
  { code: 'B00', name: 'King\'s Pawn Opening', pgn: 'e4' },
  { code: 'C20', name: 'King\'s Pawn Game', pgn: 'e4 e5' },
  { code: 'C40', name: 'King\'s Knight Opening', pgn: 'e4 e5 Nf3' },
  { code: 'D00', name: 'Queen\'s Pawn Game', pgn: 'd4 d5' },
]

function generateOpeningPGN(pgnString: string): { pgn: string; fen: string } | null {
  const chess = new Chess()
  const moves = pgnString.split(' ').filter(m => m.trim().length > 0)
  const playedMoves: string[] = []

  for (const move of moves) {
    try {
      const result = chess.move(move)
      if (result) {
        playedMoves.push(result.san)
      } else {
        break
      }
    } catch {
      break
    }
  }

  if (playedMoves.length === 0) {
    return null
  }

  const pgn = playedMoves.join(' ')
  const fen = chess.fen()

  return { pgn, fen }
}

async function importOpenings() {
  console.log('Starting opening import...')

  for (const opening of OPENING_LINES) {
    try {
      // Check if opening already exists
      const existing = await prisma.opening.findUnique({
        where: { ecoCode: opening.code },
      })

      if (existing) {
        console.log(`Skipping ${opening.code} - ${opening.name} (already exists)`)
        continue
      }

      console.log(`Importing ${opening.code} - ${opening.name}...`)
      
      const result = generateOpeningPGN(opening.pgn)
      
      if (!result) {
        console.log(`Failed to generate PGN for ${opening.code}`)
        continue
      }

      await prisma.opening.create({
        data: {
          ecoCode: opening.code,
          name: opening.name,
        },
      })

      console.log(`✓ Imported ${opening.code} - ${opening.name}`)
    } catch (error) {
      console.error(`Error importing ${opening.code}:`, error)
    }
  }

  console.log('Import complete!')
}

// Run the import
importOpenings()
  .catch((error) => {
    console.error('Import failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
