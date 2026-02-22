import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromToken } from '@/lib/auth'
import { Chess } from 'chess.js'

export async function GET(
  request: NextRequest,
  { params }: { params: { openingId: string } }
) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const openingId = params.openingId

    // Get the opening
    const opening = await prisma.opening.findUnique({
      where: { id: openingId },
    })

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    // Get all learned move nodes for this user and opening
    const learnedNodes = await prisma.userProgress.findMany({
      where: {
        userId: user.id,
        isLearned: true,
        moveNode: {
          openingId: openingId,
        },
      },
      select: {
        moveNodeId: true,
      },
    })

    const learnedNodeIds = new Set(learnedNodes.map(n => n.moveNodeId))
    
    console.log(`User ${user.id} has learned ${learnedNodeIds.size} nodes for opening ${openingId}`)

    // Get root nodes (nodes with no parent)
    const rootNodes = await prisma.moveNode.findMany({
      where: {
        openingId: openingId,
        parentNodeId: null,
      },
      orderBy: {
        popularityScore: 'desc',
      },
    })

    if (rootNodes.length === 0) {
      return NextResponse.json(
        { error: 'No moves found for this opening' },
        { status: 404 }
      )
    }

    console.log(`Found ${rootNodes.length} root nodes`)

    // Build continuation from a node following main line
    const buildContinuationFromNode = async (nodeId: string): Promise<string[]> => {
      const continuation: string[] = []
      let currentNodeId: string | null = nodeId

      while (currentNodeId) {
        const node = await prisma.moveNode.findUnique({
          where: { id: currentNodeId },
          include: {
            childNodes: {
              orderBy: {
                popularityScore: 'desc',
              },
              take: 1,
            },
          },
        })

        if (!node || node.childNodes.length === 0) break

        const nextNode = node.childNodes[0]
        const nextIsLearned = learnedNodeIds.has(nextNode.id)

        // Stop if next node is already learned
        if (nextIsLearned) break

        continuation.push(nextNode.sanMove)
        currentNodeId = nextNode.id
      }

      return continuation
    }

    // Function to traverse tree and find next unlearned line
    const findNextUnlearnedLine = async (startNodeId: string | null, pathFromRoot: string[] = []): Promise<string[] | null> => {
      if (!startNodeId) return null

      const node = await prisma.moveNode.findUnique({
        where: { id: startNodeId },
        include: {
          childNodes: {
            orderBy: {
              popularityScore: 'desc',
            },
          },
        },
      })

      if (!node) return null

      const currentPath = [...pathFromRoot, node.sanMove]
      const isLearned = learnedNodeIds.has(node.id)

      // If this node is not learned, build the full line from root to end
      if (!isLearned) {
        // Build continuation from this node
        const continuation = await buildContinuationFromNode(node.id)
        return [...currentPath, ...continuation]
      }

      // If learned, continue to children (following popularity)
      for (const child of node.childNodes) {
        const result = await findNextUnlearnedLine(child.id, currentPath)
        if (result) return result
      }

      return null
    }

    // Try each root node to find next unlearned line
    for (const rootNode of rootNodes) {
      const isRootLearned = learnedNodeIds.has(rootNode.id)
      console.log(`Checking root node ${rootNode.id} (${rootNode.sanMove}), learned: ${isRootLearned}`)
      
      const line = await findNextUnlearnedLine(rootNode.id, [])
      if (line && line.length > 0) {
        console.log(`Found unlearned line with ${line.length} moves: ${line.join(' ')}`)
        
        // Validate the line by replaying it from start
        const chess = new Chess()
        const validatedLine: string[] = []
        
        for (const moveSan of line) {
          try {
            const move = chess.move(moveSan)
            if (move) {
              validatedLine.push(move.san)
            } else {
              console.error(`Invalid move in line: ${moveSan}`)
              break
            }
          } catch (error) {
            console.error(`Error validating move ${moveSan}:`, error)
            break
          }
        }
        
        if (validatedLine.length === 0) {
          console.log(`Line validation failed, trying next root node`)
          continue // Try next root node
        }
        // Count how many lines learned to determine line number
        const learnedCount = learnedNodeIds.size
        const lineNumber = Math.floor(learnedCount / 5) + 1

        // Get description based on first unlearned node
        const firstUnlearnedNode = await prisma.moveNode.findFirst({
          where: {
            openingId: openingId,
            id: {
              notIn: Array.from(learnedNodeIds),
            },
          },
          orderBy: {
            popularityScore: 'desc',
          },
        })

        const description = firstUnlearnedNode?.isMainLine 
          ? 'Main Variation' 
          : `Variation ${lineNumber}`

        return NextResponse.json({
          line: validatedLine,
          lineNumber: lineNumber,
          description: description,
          openingName: opening.name,
        })
      }
    }

    // All lines learned!
    return NextResponse.json({
      line: [],
      lineNumber: 0,
      description: 'All variations learned!',
      openingName: opening.name,
      completed: true,
    })
  } catch (error) {
    console.error('Error getting next line:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get next line' },
      { status: 500 }
    )
  }
}
