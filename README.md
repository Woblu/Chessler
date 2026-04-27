# Vegan Chess - Ranking System

A Next.js chess application with PostgreSQL (Prisma) featuring a comprehensive ranking system.

## Features

- **User Management**: Track user statistics including rank, points, and games played
- **Game Results**: Record chess games with results (white win, black win, draw)
- **Ranking System**: 
  - 20-game cycles
  - Rank up when reaching 10+ points in a cycle
  - Bonus points for beating higher-ranked players
- **Dashboard**: Beautiful UI showing rank, points, and cycle progress
- **Real-time Chess Play**: 
  - Socket.io powered real-time multiplayer chess
  - Drag-and-drop moves with react-chessboard
  - Chess.js for move validation
  - Automatic ranking updates on game completion
- **Play Against Bots**: 
  - Stockfish.js powered AI opponents
  - Three difficulty levels (Beginner, Intermediate, Grandmaster)
  - Web Worker integration for non-blocking engine calculations
  - Automatic game result processing

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your PostgreSQL connection string  
   - **Free database:** See [docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md) for a free Supabase PostgreSQL setup.

3. **Set up the database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Set up Stockfish.js for bot games:**
   - Stockfish files are automatically copied to `/public` after `npm install` via the postinstall script
   - If files are missing, run `npm run postinstall` manually or check `node_modules/stockfish` for the source files

5. **Run the development server:**
   ```bash
   npm run dev
   ```
   
   **Note:** The app uses Cross-Origin Isolation headers (required for Stockfish.js SharedArrayBuffer support). If you see CORS errors with external resources, this is expected behavior. The headers are configured in `next.config.js`.

6. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## Production deployment

The app uses a custom Node server (Next.js + Socket.IO). **You cannot use Vercel’s default serverless** — you need a host that runs `node server.js`.

- **Free forever:** **[docs/FREE-HOSTING-GUIDE.md](docs/FREE-HOSTING-GUIDE.md)** — Render + Neon (simple; service sleeps after 15 min → cold starts).
- **Free, no cold starts:** **[docs/FLY-HOSTING-GUIDE.md](docs/FLY-HOSTING-GUIDE.md)** — Fly.io + Neon (app stays up; matchmaking works immediately).
- **Other hosts / Docker:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Railway, Render, Fly.io, VPS, env vars.

## Seeding the database

After a fresh database (or after wiping it), run these seed scripts so the app has regions, shop items, openings, and optionally puzzles.

**Order doesn’t matter** except that **tournament** creates `UserTourProgress` for existing users if you run it after signup; otherwise the campaign page will create progress on first visit.

| What              | Command                  | Notes |
|-------------------|--------------------------|--------|
| **Campaign / World Tour** | `npm run seed-tournament` | Regions + tournament nodes (no external file). |
| **Shop (cosmetics)**      | `npm run seed-shop`       | Boards and piece sets. |
| **Learn (openings)**      | `npm run seed-all-openings` | Fetches from Lichess; needs network. |
| **Puzzles**               | `npm run seed-puzzles`     | **Requires `puzzles.csv` in the project root.** |

**Puzzles:** The script reads `puzzles.csv` (not in the repo; it’s in `.gitignore`). You need a CSV with columns like `PuzzleId`, `FEN`, `Moves`, `Rating`, `Themes`. The script keeps puzzles with rating 800–1500. You can get Lichess puzzle datasets from [Lichess Open Database](https://database.lichess.org/) (e.g. puzzle themes or game-related exports) or build a CSV in that format. Without `puzzles.csv`, skip `npm run seed-puzzles`; the Puzzles page will just be empty.

**One-liner** (if you have `puzzles.csv` and want everything):

```bash
npm run seed-tournament && npm run seed-shop && npm run seed-all-openings && npm run seed-puzzles
```

## Database Schema

### User
- `id`: Unique identifier
- `name`: User's name
- `rank`: Current rank (Beginner, Novice, Intermediate, Advanced, Expert, Master, Grandmaster)
- `currentPoints`: Points accumulated in current cycle
- `gamesPlayedInCycle`: Number of games played in current cycle (0-20)
- `totalGames`: Total games played

### Game
- `id`: Unique identifier
- `whitePlayerId`: Reference to white player
- `blackPlayerId`: Reference to black player
- `result`: Game result (WHITE_WIN, BLACK_WIN, DRAW) - optional for in-progress games
- `isOnline`: Whether the game was played online
- `date`: Game date

## Ranking Logic

The `processGameResult(gameId)` function handles:

1. **Scoring:**
   - Win = 1 point
   - Loss = 0 points
   - Draw = 0.5 points

2. **Bonus Points:**
   - If winner's rank < loser's rank, winner gets +0.5 bonus points

3. **Rank Up:**
   - Users have a 20-game cycle
   - If they accumulate ≥10 points within those 20 games, they rank up
   - Cycle resets after 20 games or upon ranking up

## API Endpoints

- `POST /api/games/process` - Process a game result
  ```json
  {
    "gameId": "game-id-here"
  }
  ```

- `GET /api/users/[id]` - Get user statistics

- `POST /api/games/create-online` - Create an online game for real-time play
  ```json
  {
    "whitePlayerId": "player-id",
    "blackPlayerId": "player-id"
  }
  ```

- `POST /api/games/create` - Create a game with a result (for completed games)
  ```json
  {
    "whitePlayerId": "player-id",
    "blackPlayerId": "player-id",
    "result": "WHITE_WIN" | "BLACK_WIN" | "DRAW",
    "isOnline": false
  }
  ```

## Real-time Play

The application includes a real-time chess play area:

1. **Create an online game** using `/api/games/create-online`
2. **Navigate to** `/play/[gameId]` with both players
3. **Enter your player ID** to join the game
4. **Make moves** by dragging and dropping pieces (only on your turn)
5. **Game automatically ends** on checkmate or draw
6. **Ranking is updated** automatically when the game ends

### Socket.io Events

- `join_game` - Join a game room
  ```json
  { "gameId": "game-id", "playerId": "player-id" }
  ```

- `make_move` - Make a chess move
  ```json
  { "from": "e2", "to": "e4", "promotion": "q" }
  ```

- `game_over` - Emitted when game ends (checkmate/draw)

## Play Against Bots

The application includes an AI opponent feature powered by Stockfish.js:

1. **Navigate to** `/play/bot` from the Play page
2. **Select a bot difficulty:**
   - **Beginner Bot**: Skill Level 1, Depth 1 - Perfect for learning
   - **Intermediate Bot**: ELO 1500, Depth 5 - Good tactical awareness
   - **Grandmaster Bot**: ELO 2500, Depth 15 - Extremely strong
3. **Start the game** - You play as white, the bot plays as black
4. **Make your moves** - The bot will automatically respond
5. **Game results** are automatically saved and processed for ranking

### Bot Game Setup

- Bot games use a system "Bot" user account (created automatically)
- Game results are saved to the database and processed through the ranking system
- Bot games count toward your ranking and cycle progress

## Usage Example

```typescript
import { processGameResult } from '@/lib/ranking'

// After creating a game, process the result
await processGameResult(gameId)
```
