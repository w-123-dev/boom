var db = require('./server/db');
var sql = 'UPDATE users SET total_games = total_games + 1, rating = MAX(100, rating + -5) WHERE id = ?';
try { db.prepare(sql).run(1); console.log('OK'); } catch(e) { console.log('Error:', e.message); }
