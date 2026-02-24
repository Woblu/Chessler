'use client'

import React from 'react'
import { CustomPieceFn } from 'react-chessboard/dist/chessboard/types'

/**
 * Generate custom pieces mapping for a given piece set
 * @param pieceSet - The name of the piece set folder in /public/Pieces/ (e.g., "cardinal", "pixel")
 */
export function getCustomPieces(pieceSet: string = 'cardinal'): { [key: string]: CustomPieceFn } {
  const createPiece = (pieceName: string, alt: string): CustomPieceFn => {
    return ({ squareWidth }) => (
      <img
        style={{ width: squareWidth, height: squareWidth }}
        src={`/Pieces/${pieceSet}/${pieceName}.svg`}
        alt={alt}
        onError={(e) => {
          // Fallback to default set if image not found
          const target = e.target as HTMLImageElement
          // Prevent infinite loop - only try default if not already trying default
          if (!target.src.includes('/default/') && !target.dataset.fallback) {
            target.dataset.fallback = 'true'
            target.src = `/Pieces/cardinal/${pieceName}.svg`
          } else {
            // If default also fails, show a placeholder or hide
            target.style.opacity = '0.3'
            target.alt = `${alt} (not found)`
          }
        }}
      />
    )
  }

  return {
    wP: createPiece('wP', 'White Pawn'),
    wR: createPiece('wR', 'White Rook'),
    wN: createPiece('wN', 'White Knight'),
    wB: createPiece('wB', 'White Bishop'),
    wQ: createPiece('wQ', 'White Queen'),
    wK: createPiece('wK', 'White King'),
    bP: createPiece('bP', 'Black Pawn'),
    bR: createPiece('bR', 'Black Rook'),
    bN: createPiece('bN', 'Black Knight'),
    bB: createPiece('bB', 'Black Bishop'),
    bQ: createPiece('bQ', 'Black Queen'),
    bK: createPiece('bK', 'Black King'),
  }
}

/**
 * Board style id → image filename (must match Settings BOARD_STYLES and files in /public/Boards/)
 */
export const BOARD_STYLE_IMAGES: Record<string, string> = {
  canvas2: 'canvas2.jpg',
  green: 'green.png',
  horsey: 'horsey.jpg',
  metal: 'metal.jpg',
  olive: 'olive.jpg',
  'purple-diag': 'purple-diag.png',
  wood2: 'wood2.jpg',
  wood4: 'wood4.jpg',
}

/**
 * Returns the board image URL for a Settings board style id, or null if unknown.
 * Use this so the actual board image is shown (e.g. in play, puzzles, learn).
 */
export function getBoardStyleImageUrl(boardStyleId: string | undefined | null): string | null {
  if (!boardStyleId) return null
  const image = BOARD_STYLE_IMAGES[boardStyleId]
  return image ? `/Boards/${image}` : null
}

/**
 * Get custom square styles for a given board style
 * @param boardStyle - The name of the board style image file (e.g., "canvas2", "wood2")
 */
export function getCustomSquareStyles(boardStyle: string = 'canvas2') {
  // Board color mappings - used when no board image is available
  const boardColors: { [key: string]: { light: string; dark: string } } = {
    canvas2: { light: '#f0d9b5', dark: '#b58863' },
    green: { light: '#f0d9b5', dark: '#7fa650' },
    horsey: { light: '#f0d9b5', dark: '#8b4513' },
    metal: { light: '#e8e8e8', dark: '#4a4a4a' },
    olive: { light: '#d4d4aa', dark: '#6b8e23' },
    'purple-diag': { light: '#d4a5d4', dark: '#8b4a8b' },
    wood2: { light: '#f0d9b5', dark: '#b58863' },
    wood4: { light: '#f0d9b5', dark: '#b58863' },
  }

  const colors = boardColors[boardStyle] || boardColors.canvas2

  // Use solid colors for now - the board images are full boards, not individual squares
  // If you want to use the board images, you'd need to extract individual square images
  return {
    dark: {
      backgroundColor: colors.dark,
    },
    light: {
      backgroundColor: colors.light,
    },
  }
}

// Default exports for backward compatibility (using first available set)
export const customPieces = getCustomPieces('cardinal')
export const customDarkSquareStyle = getCustomSquareStyles('canvas2').dark
export const customLightSquareStyle = getCustomSquareStyles('canvas2').light
