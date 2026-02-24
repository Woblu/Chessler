-- Performance indexes for high-traffic queries
-- Safe to run multiple times (IF NOT EXISTS)

-- Game table: player lookups (profile history, win counts)
CREATE INDEX IF NOT EXISTS "games_white_player_idx" ON games ("whitePlayerId");
CREATE INDEX IF NOT EXISTS "games_black_player_idx" ON games ("blackPlayerId");
-- Game table: date ordering (recent games list)
CREATE INDEX IF NOT EXISTS "games_date_idx" ON games (date DESC);
-- Game table: result filtering (win/loss counts)
CREATE INDEX IF NOT EXISTS "games_result_idx" ON games (result);

-- UserCosmetic: fast lookups by user
CREATE INDEX IF NOT EXISTS "user_cosmetics_user_idx" ON user_cosmetics ("userId");
