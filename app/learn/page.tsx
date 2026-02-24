// Opening catalogue is static data — revalidate every hour
export const revalidate = 3600

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'
import SearchBar from '@/components/SearchBar'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Opening {
  id: string
  ecoCode: string
  name: string
  pgnPreview: string | null
}

interface PageProps {
  searchParams: { q?: string; page?: string }
}

async function getOpenings(searchTerm: string | undefined, page: number) {
  const pageSize = 50
  const skip = (page - 1) * pageSize

  // Build where clause for search
  const where = searchTerm
    ? {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' as const } },
          { ecoCode: { contains: searchTerm, mode: 'insensitive' as const } },
        ],
      }
    : {}

  // Get total count
  const totalCount = await prisma.opening.count({ where })

  // Get openings with pagination
  const openings = await prisma.opening.findMany({
    where,
    take: pageSize,
    skip,
    orderBy: [
      { ecoCode: 'asc' },
      { name: 'asc' },
    ],
    include: {
      moveNodes: {
        where: {
          parentNodeId: null, // Root nodes only
          isMainLine: true,
        },
        orderBy: {
          popularityScore: 'desc',
        },
        take: 1,
        select: {
          id: true,
          sanMove: true,
        },
      },
    },
  })

  // Get root node IDs for fetching child nodes
  const rootNodeIds = openings
    .filter(o => o.moveNodes.length > 0)
    .map(o => o.moveNodes[0].id)

  // Fetch all child nodes in one query
  const allChildNodes = rootNodeIds.length > 0
    ? await prisma.moveNode.findMany({
        where: {
          parentNodeId: { in: rootNodeIds },
          isMainLine: true,
        },
        orderBy: [
          { parentNodeId: 'asc' },
          { popularityScore: 'desc' },
        ],
        select: {
          id: true,
          parentNodeId: true,
          sanMove: true,
        },
      })
    : []

  // Group child nodes by parent
  const childNodesByParent = new Map<string, typeof allChildNodes>()
  for (const node of allChildNodes) {
    if (node.parentNodeId) {
      const existing = childNodesByParent.get(node.parentNodeId) || []
      existing.push(node)
      childNodesByParent.set(node.parentNodeId, existing)
    }
  }

  // Build PGN previews
  const openingsWithPreview: Opening[] = openings.map((opening) => {
    let pgnPreview: string | null = null

    if (opening.moveNodes.length > 0) {
      const rootNode = opening.moveNodes[0]
      const moves: string[] = [rootNode.sanMove]

      // Get first child node
      const children = childNodesByParent.get(rootNode.id) || []
      if (children.length > 0) {
        moves.push(children[0].sanMove)
      }

      pgnPreview = moves.join(' ')
    }

    return {
      id: opening.id,
      ecoCode: opening.ecoCode,
      name: opening.name,
      pgnPreview,
    }
  })

  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    openings: openingsWithPreview,
    totalCount,
    totalPages,
    currentPage: page,
  }
}

function OpeningCard({ opening }: { opening: Opening }) {
  return (
    <Link
      href={`/learn/${opening.id}`}
      className="block p-6 bg-chess-card rounded-xl border border-chess-border hover:border-pawn-gold transition-all hover:shadow-lg hover:shadow-pawn-gold/10 group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="px-3 py-1 bg-pawn-gold text-slate-900 text-sm font-bold rounded-md">
          {opening.ecoCode}
        </span>
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
        {opening.name}
      </h3>
      
      {opening.pgnPreview && (
        <p className="text-slate-400 text-sm font-mono truncate">
          {opening.pgnPreview}
        </p>
      )}
      
      <div className="mt-4 text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
        Click to learn →
      </div>
    </Link>
  )
}

function Pagination({ currentPage, totalPages, searchTerm }: { currentPage: number; totalPages: number; searchTerm?: string }) {
  const buildUrl = (page: number) => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('q', searchTerm)
    if (page > 1) params.set('page', page.toString())
    return `/learn${params.toString() ? `?${params.toString()}` : ''}`
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <Link
        href={buildUrl(currentPage - 1)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          currentPage > 1
            ? 'bg-chess-card border-chess-border text-white hover:bg-slate-700 hover:border-pawn-gold'
            : 'bg-chess-bg border-chess-border text-slate-400 cursor-not-allowed'
        }`}
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </Link>

      <div className="text-slate-400">
        Page <span className="text-white font-semibold">{currentPage}</span> of{' '}
        <span className="text-white font-semibold">{totalPages}</span>
      </div>

      <Link
        href={buildUrl(currentPage + 1)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          currentPage < totalPages
            ? 'bg-chess-card border-chess-border text-white hover:bg-slate-700 hover:border-pawn-gold'
            : 'bg-chess-bg border-chess-border text-slate-400 cursor-not-allowed'
        }`}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

export default async function LearnPage({ searchParams }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/login')
  const searchTerm = searchParams.q
  const page = parseInt(searchParams.page || '1', 10)
  const validPage = page > 0 ? page : 1

  const { openings, totalCount, totalPages, currentPage } = await getOpenings(searchTerm, validPage)

  return (
    <div className="min-h-screen bg-chess-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Opening Explorer</h1>
          <p className="text-slate-400">
            {totalCount.toLocaleString()} {totalCount === 1 ? 'opening' : 'openings'} available
            {searchTerm && ` • ${openings.length} result${openings.length === 1 ? '' : 's'} for "${searchTerm}"`}
          </p>
        </div>

        {/* Search Bar */}
        <Suspense fallback={<div className="h-16 mb-8" />}>
          <SearchBar />
        </Suspense>

        {/* Openings Grid */}
        {openings.length === 0 ? (
          <div className="text-center py-16 bg-chess-card rounded-xl border border-chess-border">
            <p className="text-slate-300 text-lg mb-2">
              {searchTerm ? 'No openings found' : 'No openings available'}
            </p>
            {searchTerm ? (
              <p className="text-slate-400 text-sm">Try a different search term</p>
            ) : (
              <p className="text-slate-400 text-sm">
                Run: <code className="bg-chess-bg px-2 py-1 rounded border border-chess-border text-pawn-gold">npm run seed-all-openings</code>
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {openings.map((opening) => (
                <OpeningCard key={opening.id} opening={opening} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              searchTerm={searchTerm}
            />
          </>
        )}
      </div>
    </div>
  )
}
