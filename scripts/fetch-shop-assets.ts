import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Asset sources - Expanded list from Lichess
// This list mirrors the official folder names under https://github.com/lichess-org/lila/tree/master/public/piece
// Add more here over time if Lichess introduces new sets.
const PIECE_SETS = [
  'cburnett',
  'alpha',
  'fantasy',
  'shapes',
  'spatial',
  'california',
  'pirouetti',
  'chessnut',
  'chess7',
  'companion',
  'riohacha',
  'kosal',
  'leipzig',
  'governor',
  'dubrovny',
  'icpieces',
  'cardinal',
  'gioco',
  'pixel',
  'maestro',
  'fresca',
  'tatiana',
]
const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
const BOARD_TEXTURES = [
  { name: 'wood.jpg', displayName: 'Classic Wood' },
  { name: 'blue.png', displayName: 'Ocean Blue' },
  { name: 'green.png', displayName: 'Forest Green' },
  { name: 'marble.jpg', displayName: 'Marble Elegance' },
  { name: 'leather.jpg', displayName: 'Leather' },
  { name: 'maple.jpg', displayName: 'Maple Wood' },
  { name: 'metal.jpg', displayName: 'Metal' },
  { name: 'olive.jpg', displayName: 'Olive' },
  { name: 'wood2.jpg', displayName: 'Wood 2' },
  { name: 'wood3.jpg', displayName: 'Wood 3' },
]

const PIECE_BASE_URL = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece'
const BOARD_BASE_URL = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/images/board'

// Ensure directories exist
function ensureDirectories() {
  const boardsDir = path.join(process.cwd(), 'public', 'assets', 'boards')
  const piecesDir = path.join(process.cwd(), 'public', 'pieces')

  if (!fs.existsSync(boardsDir)) {
    fs.mkdirSync(boardsDir, { recursive: true })
    console.log(`✓ Created directory: ${boardsDir}`)
  }

  if (!fs.existsSync(piecesDir)) {
    fs.mkdirSync(piecesDir, { recursive: true })
    console.log(`✓ Created directory: ${piecesDir}`)
  }

  return { boardsDir, piecesDir }
}

// Download a file from URL and save to disk
async function downloadFile(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error(`✗ Failed to download ${url}: ${response.status} ${response.statusText}`)
      return false
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Ensure parent directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(outputPath, buffer)
    return true
  } catch (error) {
    console.error(`✗ Error downloading ${url}:`, error)
    return false
  }
}

// Download all piece sets
async function downloadPieceSets(piecesDir: string) {
  console.log('\n📦 Downloading piece sets...')
  
  for (const set of PIECE_SETS) {
    const setDir = path.join(piecesDir, set)
    console.log(`\n  Downloading ${set} set...`)
    
    let successCount = 0
    for (const piece of PIECES) {
      const url = `${PIECE_BASE_URL}/${set}/${piece}.svg`
      const outputPath = path.join(setDir, `${piece}.svg`)
      
      const success = await downloadFile(url, outputPath)
      if (success) {
        successCount++
        process.stdout.write(`    ✓ ${piece}.svg`)
      } else {
        process.stdout.write(`    ✗ ${piece}.svg`)
      }
    }
    
    console.log(`\n  ${set}: ${successCount}/${PIECES.length} pieces downloaded`)
  }
}

// Download all board textures
async function downloadBoardTextures(boardsDir: string) {
  console.log('\n🎨 Downloading board textures...')
  
  for (const board of BOARD_TEXTURES) {
    const url = `${BOARD_BASE_URL}/${board.name}`
    const outputPath = path.join(boardsDir, board.name)
    
    process.stdout.write(`  Downloading ${board.name}... `)
    const success = await downloadFile(url, outputPath)
    
    if (success) {
      console.log('✓')
    } else {
      console.log('✗')
    }
  }
}

// Clean up cosmetics that reference non-existent assets
async function cleanupCosmetics() {
  console.log('\n🧹 Cleaning up cosmetics with missing assets...')
  
  // Get all cosmetics
  const allCosmetics = await prisma.cosmetic.findMany()
  
  for (const cosmetic of allCosmetics) {
    if (cosmetic.type === 'PIECES') {
      // Check if piece set directory exists
      const pieceSetPath = path.join(process.cwd(), 'public', 'pieces', cosmetic.asset_url)
      if (!fs.existsSync(pieceSetPath)) {
        console.log(`  ✗ Removing ${cosmetic.name} (piece set ${cosmetic.asset_url} not found)`)
        await prisma.cosmetic.delete({ where: { id: cosmetic.id } })
      }
    } else if (cosmetic.type === 'BOARD') {
      // Check if board file exists
      const boardPath = path.join(process.cwd(), 'public', cosmetic.asset_url)
      if (!fs.existsSync(boardPath)) {
        console.log(`  ✗ Removing ${cosmetic.name} (board ${cosmetic.asset_url} not found)`)
        await prisma.cosmetic.delete({ where: { id: cosmetic.id } })
      }
    }
  }
}

// Insert cosmetics into database
async function seedCosmetics() {
  console.log('\n💾 Seeding cosmetics to database...')
  
  // Piece set pricing map
  const pieceSetPricing: { [key: string]: number } = {
    'cburnett': 0,      // Free default
    'alpha': 50,
    'spatial': 75,
    'fantasy': 100,
    'shapes': 100,
    'chessnut': 125,
    'california': 125,
    'pirouetti': 150,
    'chess7': 150,
    'companion': 175,
    'riohacha': 175,
    'kosal': 200,
    'leipzig': 200,
    'governor': 200,
    'dubrovny': 225,
    'icpieces': 225,
    'cardinal': 250,
    'gioco': 250,
    'pixel': 250,
    'maestro': 300,
    'fresca': 300,
    'tatiana': 300,
  }

  // Insert piece sets
  for (const set of PIECE_SETS) {
    const displayName = set.charAt(0).toUpperCase() + set.slice(1).replace(/([A-Z])/g, ' $1').trim() + ' Pieces'
    const price = pieceSetPricing[set] ?? 100 // Default to 100 if not in pricing map
    
    try {
      const existing = await prisma.cosmetic.findFirst({
        where: {
          name: displayName,
          type: 'PIECES',
        },
      })

      if (existing) {
        console.log(`  ⏭️  Skipped: ${displayName} (already exists)`)
      } else {
        await prisma.cosmetic.create({
          data: {
            name: displayName,
            type: 'PIECES',
            price,
            asset_url: set, // Store the set name as asset_url
          },
        })
        console.log(`  ✓ Created: ${displayName} - ${price} pawns`)
      }
    } catch (error) {
      console.error(`  ✗ Error creating ${displayName}:`, error)
    }
  }

  // Insert board textures with varied pricing
  const boardPricing: { [key: string]: number } = {
    'wood.jpg': 0,        // Free default
    'blue.png': 75,
    'green.png': 75,
    'brown.jpg': 75,
    'canvas.jpg': 100,
    'leather.jpg': 100,
    'marble.jpg': 100,
    'maple.jpg': 125,
    'metal.jpg': 125,
    'olive.jpg': 125,
    'purple.jpg': 150,
    'red.jpg': 150,
    'wood2.jpg': 150,
    'wood3.jpg': 150,
  }

  for (const board of BOARD_TEXTURES) {
    const price = boardPricing[board.name] ?? 100 // Default to 100 if not in pricing map
    
    try {
      const existing = await prisma.cosmetic.findFirst({
        where: {
          name: board.displayName,
          type: 'BOARD',
        },
      })

      if (existing) {
        console.log(`  ⏭️  Skipped: ${board.displayName} (already exists)`)
      } else {
        await prisma.cosmetic.create({
          data: {
            name: board.displayName,
            type: 'BOARD',
            price,
            asset_url: `/assets/boards/${board.name}`, // Full path for boards
          },
        })
        console.log(`  ✓ Created: ${board.displayName} - ${price} pawns`)
      }
    } catch (error) {
      console.error(`  ✗ Error creating ${board.displayName}:`, error)
    }
  }
}

// Main function
async function main() {
  console.log('🛍️  Fetching shop assets from Lichess...\n')

  try {
    // Ensure directories exist
    const { boardsDir, piecesDir } = ensureDirectories()

    // Download piece sets
    await downloadPieceSets(piecesDir)

    // Download board textures
    await downloadBoardTextures(boardsDir)

    // Seed cosmetics to database
    await seedCosmetics()

    console.log('\n✅ All assets fetched and seeded successfully!')
  } catch (error) {
    console.error('\n❌ Error fetching assets:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
