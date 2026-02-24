'use client'

import { Chessboard } from 'react-chessboard'
import { ChessboardProps, CustomPieceFn } from 'react-chessboard/dist/chessboard/types'
import { getCustomSquareStyles, getBoardStyleImageUrl } from '@/lib/chess-customization'

interface CustomBoardProps extends Omit<ChessboardProps, 'customPieces' | 'customDarkSquareStyle' | 'customLightSquareStyle' | 'ref'> {
  equippedBoardUrl?: string | null
  equippedPieceSet?: string | null
  /** Used when no piece cosmetic is equipped (e.g. user's Settings preference) */
  fallbackPieceSet?: string
  /** Used when no board cosmetic is equipped (e.g. user's Settings preference) */
  fallbackBoardStyle?: string
}

export default function CustomBoard({
  equippedBoardUrl,
  equippedPieceSet,
  fallbackPieceSet = 'cardinal',
  fallbackBoardStyle = 'canvas2',
  ...chessboardProps
}: CustomBoardProps) {
  // Use equipped piece set, or fall back to user's saved preference
  const pieceSet = equippedPieceSet ?? fallbackPieceSet
  const customPieces = createCustomPieces(pieceSet)

  // Use equipped board image, or user's Settings board image, or solid colors
  const boardImageUrl = equippedBoardUrl ?? getBoardStyleImageUrl(fallbackBoardStyle)
  const squareStyleFromImage = boardImageUrl
    ? {
        backgroundImage: `url(${boardImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : null
  const fallbackStyles = getCustomSquareStyles(fallbackBoardStyle)

  const customDarkSquareStyle = squareStyleFromImage ?? fallbackStyles.dark
  const customLightSquareStyle = squareStyleFromImage ?? fallbackStyles.light

  return (
    <Chessboard
      animationDuration={200}
      {...chessboardProps}
      customPieces={customPieces}
      customDarkSquareStyle={customDarkSquareStyle}
      customLightSquareStyle={customLightSquareStyle}
    />
  )
}

// Helper function to create custom pieces mapping
function createCustomPieces(pieceSet: string): { [key: string]: CustomPieceFn } {
  const pieceNames = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK', 'bP', 'bR', 'bN', 'bB', 'bQ', 'bK']

  const createPiece = (pieceName: string): CustomPieceFn => {
    return ({ squareWidth }) => (
      <img
        style={{ width: squareWidth, height: squareWidth }}
        src={`/Pieces/${pieceSet.toLowerCase()}/${pieceName}.svg`}
        alt={pieceName}
        onError={(e) => {
          // Fallback to default if image not found
          const target = e.target as HTMLImageElement
          if (!target.dataset.fallback) {
            target.dataset.fallback = 'true'
            target.src = `/Pieces/cardinal/${pieceName}.svg`
          } else {
            // If default also fails, reduce opacity
            target.style.opacity = '0.3'
          }
        }}
      />
    )
  }

  const pieces: { [key: string]: CustomPieceFn } = {}
  pieceNames.forEach((pieceName) => {
    pieces[pieceName] = createPiece(pieceName)
  })

  return pieces
}
