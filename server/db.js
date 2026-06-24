const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'database.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    avatar TEXT DEFAULT 'default',
    rating INTEGER DEFAULT 1000,
    total_games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    game_type TEXT NOT NULL,
    max_players INTEGER NOT NULL,
    started_at DATETIME,
    ended_at DATETIME,
    duration_secs INTEGER,
    status TEXT CHECK(status IN ('waiting','playing','finished')) DEFAULT 'waiting'
  );

  CREATE TABLE IF NOT EXISTS match_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    player_index INTEGER NOT NULL,
    is_winner INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    survived_secs INTEGER DEFAULT 0,
    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('pending','accepted')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  );

  CREATE INDEX IF NOT EXISTS idx_matches_room ON matches(room_id);
  CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
  CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);
`);

module.exports = db;
