import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import csv from 'csv-parser'

const prisma = new PrismaClient()

interface PuzzleRow {
  PuzzleId: string
  FEN: string
  Moves: string
  Rating: string
  RatingDeviation: string
  Popularity: string
  NbPlays: string
  Themes: string
  GameUrl: string
  OpeningTags: string
}

async function seedPuzzles() {
  console.log('Starting puzzle seeding...')

  const csvFilePath = path.join(process.cwd(), 'puzzles.csv')

  // Check if file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: puzzles.csv not found at ${csvFilePath}`)
    process.exit(1)
  }

  const puzzles: Array<{
    id: string
    fen: string
    moves: string
    rating: number
    themes: string
    pawnReward: number
  }> = []

  let totalProcessed = 0
  let totalFiltered = 0
  let batchCount = 0

  return new Promise<void>((resolve, reject) => {
    let processingBatch = false

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row: PuzzleRow) => {
        totalProcessed++

        // Filter by rating (800-1500)
        const rating = parseInt(row.Rating, 10)
        if (isNaN(rating) || rating < 800 || rating > 1500) {
          return
        }

        // Require id, FEN, and Moves so we don't insert invalid rows
        const id = row.PuzzleId?.trim()
        const fen = row.FEN?.trim()
        const moves = row.Moves?.trim()
        if (!id || !fen || !moves) {
          return
        }

        totalFiltered++

        puzzles.push({
          id,
          fen,
          moves,
          rating,
          themes: (row.Themes ?? '').trim(),
          pawnReward: 5,
        })

        // Process in batches of 1000
        if (puzzles.length >= 1000 && !processingBatch) {
          processingBatch = true
          const batch = puzzles.splice(0, 1000)
          batchCount++

          prisma.puzzle
            .createMany({
              data: batch,
              skipDuplicates: true, // Skip if puzzle ID already exists
            })
            .then(() => {
              console.log(
                `Batch ${batchCount}: Inserted 1000 puzzles (Total processed: ${totalProcessed}, Total filtered: ${totalFiltered})`
              )
              processingBatch = false
            })
            .catch((error) => {
              console.error(`Error inserting batch ${batchCount}:`, error)
              processingBatch = false
              // Continue processing other batches
            })
        }

        // Progress update every 10000 rows
        if (totalProcessed % 10000 === 0) {
          console.log(`Processed ${totalProcessed} rows, filtered ${totalFiltered} puzzles...`)
        }
      })
      .on('end', async () => {
        console.log('Finished reading CSV file')

        // Insert remaining puzzles in batches of 1000 (same as during stream)
        while (puzzles.length > 0) {
          const batch = puzzles.splice(0, 1000)
          batchCount++
          try {
            await prisma.puzzle.createMany({
              data: batch,
              skipDuplicates: true,
            })
            console.log(
              `Batch ${batchCount}: Inserted ${batch.length} puzzles (Total processed: ${totalProcessed}, Total filtered: ${totalFiltered})`
            )
          } catch (error) {
            console.error(`Error inserting batch ${batchCount}:`, error)
            reject(error)
            return
          }
        }

        console.log('\n=== Seeding Complete ===')
        console.log(`Total rows processed: ${totalProcessed}`)
        console.log(`Total puzzles passing filter: ${totalFiltered}`)
        console.log(`Total batches: ${batchCount}`)

        resolve()
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error)
        reject(error)
      })
  })
}

async function main() {
  try {
    await seedPuzzles()
  } catch (error) {
    console.error('Error seeding puzzles:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
