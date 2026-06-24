var db = require('./server/db');
var r = db.prepare("INSERT INTO matches (room_id, game_type, max_players, started_at, ended_at, duration_secs, status) VALUES (?,?,?,datetime('now'),datetime('now'),0,'finished')").run('TEST','bomberman',2);
console.log('OK, id:', r.lastInsertRowid);
var r2 = db.prepare("INSERT INTO match_players (match_id, user_id, player_index, is_winner, kills) VALUES (?,?,?,?,?)").run(r.lastInsertRowid, 1, 0, 1, 0);
console.log('Player inserted');
var sql = "UPDATE users SET total_games = total_games + 1, rating = MAX(100, rating + 20) WHERE id = ?";
db.prepare(sql).run(1);
console.log('Rating updated');
console.log('All OK');
