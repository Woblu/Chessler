'use client'

import { Chessboard } from 'react-chessboard'
import { ChessboardProps, CustomPieceFn } from 'react-chessboard/dist/chessboard/types'

interface CustomBoardProps extends Omit<ChessboardProps, 'customPieces' | 'customDarkSquareStyle' | 'customLightSquareStyle' | 'ref'> {
  equippedBoardUrl?: string | null
  equippedPieceSet?: string | null
}

export default function CustomBoard({
  equippedBoardUrl,
  equippedPieceSet,
  ...chessboardProps
}: CustomBoardProps) {
  // Create custom pieces if equippedPieceSet is provided
  const customPieces = equippedPieceSet
    ? createCustomPieces(equippedPieceSet)
    : undefined

  // Create custom square styles if equippedBoardUrl is provided
  const customDarkSquareStyle = equippedBoardUrl
    ? {
        backgroundImage: `url(${equippedBoardUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined

  const customLightSquareStyle = equippedBoardUrl
    ? {
        backgroundImage: `url(${equippedBoardUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined

  return (
    <Chessboard
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
        src={`/pieces/${pieceSet.toLowerCase()}/${pieceName}.svg`}
        alt={pieceName}
        onError={(e) => {
          // Fallback to default if image not found
          const target = e.target as HTMLImageElement
          if (!target.dataset.fallback) {
            target.dataset.fallback = 'true'
            target.src = `/pieces/caliente/${pieceName}.svg`
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
