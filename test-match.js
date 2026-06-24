var db = require('./server/db');
var m = db.prepare("INSERT INTO matches (room_id, game_type, max_players, started_at, ended_at, duration_secs, status) VALUES (?,?,?,datetime('now'),datetime('now'),0,'finished')").run('TEST','bomberman',2);
console.log('Match:', m.lastInsertRowid);
try {
  db.prepare("INSERT INTO match_players (match_id, user_id, player_index, is_winner, kills) VALUES (?,?,?,?,?)").run(m.lastInsertRowid, 1, 0, 1, 0);
  console.log('Player OK');
} catch(e) { console.log('Error:', e.message); }
