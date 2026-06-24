var generateMap = require('./map').generateMap;
var TILE = require('./map').TILE;
var Bomb = require('./bomb').Bomb;
var nextBombId = require('./bomb').nextBombId;
var Player = require('./player').Player;
var PowerUp = require('./powerup').PowerUp;
var rollPowerup = require('./powerup').rollPowerup;

var GRID_SIZE = 40;
var INVINCIBLE_TICKS = 30;
var MOVE_COOLDOWN = 3; // Move every 3 ticks (150ms)

var SPEED_LEVELS = [4, 3, 2, 1, 1]; // moveCooldown at each speed level (lower = faster)
var SPEED_INTERVAL = 1200; // ticks per minute (50ms * 1200 = 60s)
var BOMB_INTERVAL = 2400;  // ticks per 2 minutes

function BombermanGame(players, config) {
  this.config = config;
  this.gridSize = GRID_SIZE;
  this.state = 'playing';
  this.winner = null;
  this.tickCount = 0;
  this.deathOrder = [];
  this.elapsedMinutes = 0; // Track elapsed game minutes for gradual speedup

  var mapData = generateMap(config.DEFAULT_MAP_WIDTH || 13, config.DEFAULT_MAP_HEIGHT || 13);
  this.map = mapData.map;
  this.mapWidth = mapData.width;
  this.mapHeight = mapData.height;

  this.players = [];
  for (var i = 0; i < players.length; i++) {
    var pp = new Player(players[i].userId, players[i].nickname, i);
    pp.moveCooldown = 0;
    pp.moveCooldownBase = MOVE_COOLDOWN;
    this.players.push(pp);
  }

  this.bombs = [];
  this.powerups = [];
  this.explosions = [];

  this.inputs = {};
  for (var j = 0; j < this.players.length; j++) {
    this.inputs[this.players[j].id] = { up: false, down: false, left: false, right: false, bomb: false };
  }

  this.invincible = {};
  for (var k = 0; k < this.players.length; k++) {
    this.invincible[this.players[k].id] = INVINCIBLE_TICKS;
  }
}

BombermanGame.prototype.handleInput = function(userId, data) {
  if (!this.inputs[userId]) return;
  var input = this.inputs[userId];
  if (data.dir === 'up') input.up = data.pressed;
  if (data.dir === 'down') input.down = data.pressed;
  if (data.dir === 'left') input.left = data.pressed;
  if (data.dir === 'right') input.right = data.pressed;
  if (data.action === 'bomb') input.bomb = data.pressed;
};

BombermanGame.prototype.tick = function() {
  if (this.state === 'finished') return this.getState();
  this.tickCount++;
  this.processMovements();
  this.processBombs();
  this.processPickups();
  for (var id in this.invincible) {
    if (this.invincible[id] > 0) this.invincible[id]--;
  }
  this.checkWinCondition();
  this.processTimeProgress();
  return this.getState();
};

BombermanGame.prototype.processMovements = function() {
  for (var i = 0; i < this.players.length; i++) {
    var player = this.players[i];
    if (!player.alive) continue;
    if (player.moveCooldown > 0) { player.moveCooldown--; continue; }
    var input = this.inputs[player.id];
    if (!input) continue;
    var dx = 0, dy = 0;
    if (input.up) { dy = -1; player.direction = 1; }
    else if (input.down) { dy = 1; player.direction = 0; }
    else if (input.left) { dx = -1; player.direction = 2; }
    else if (input.right) { dx = 1; player.direction = 3; }
    if (dx === 0 && dy === 0) continue;
    var nx = player.x + dx;
    var ny = player.y + dy;
    if (this.canMoveTo(nx, ny, player)) {
      player.x = nx;
      player.y = ny;
      player.moveCooldown = (player.speed >= 2) ? 1 : player.moveCooldownBase;
    }
  }
};

BombermanGame.prototype.canMoveTo = function(x, y, player) {
  if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return false;
  if (this.map[y][x] === TILE.HARD) return false;
  if (this.map[y][x] === TILE.SOFT) return false;
  for (var i = 0; i < this.bombs.length; i++) {
    if (!this.bombs[i].exploded && this.bombs[i].x === x && this.bombs[i].y === y) return false;
  }
  for (var j = 0; j < this.players.length; j++) {
    if (this.players[j].id !== player.id && this.players[j].alive && this.players[j].x === x && this.players[j].y === y) return false;
  }
  return true;
};

BombermanGame.prototype.plantBomb = function(userId) {
  var player = null;
  for (var i = 0; i < this.players.length; i++) {
    if (this.players[i].id === userId) { player = this.players[i]; break; }
  }
  if (!player || !player.alive) return false;
  if (player.activeBombs >= player.maxBombs) return false;
  for (var j = 0; j < this.bombs.length; j++) {
    if (!this.bombs[j].exploded && this.bombs[j].x === player.x && this.bombs[j].y === player.y) return false;
  }
  var bomb = new Bomb(nextBombId(), userId, player.x, player.y, player.bombRange, this.config.BOMB_FUSE_MS || 3000);
  this.bombs.push(bomb);
  player.activeBombs++;
  return true;
};

BombermanGame.prototype.processBombs = function() {
  var now = Date.now();
  for (var i = 0; i < this.bombs.length; i++) {
    var bomb = this.bombs[i];
    if (!bomb.exploded && (now - bomb.plantedAt >= bomb.fuseMs)) {
      this.explodeBomb(bomb);
    }
  }
};

BombermanGame.prototype.explodeBomb = function(bomb) {
  bomb.exploded = true;
  bomb.explosionStartTime = Date.now();
  var cells = bomb.calculateExplosion({ map: this.map, width: this.mapWidth, height: this.mapHeight });
  bomb.explosionCells = cells;

  for (var i = 0; i < this.players.length; i++) {
    if (this.players[i].id === bomb.ownerId) { this.players[i].activeBombs--; break; }
  }

  for (var c = 0; c < cells.length; c++) {
    var cell = cells[c];
    if (this.map[cell.y][cell.x] === TILE.SOFT) {
      this.map[cell.y][cell.x] = TILE.EMPTY;
      if (Math.random() < 0.4) {
        this.powerups.push(new PowerUp(cell.x, cell.y, rollPowerup()));
      }
    }
  }

  for (var c2 = 0; c2 < cells.length; c2++) {
    var cell2 = cells[c2];
    for (var p = 0; p < this.players.length; p++) {
      var player = this.players[p];
      if (!player.alive) continue;
      if (player.x === cell2.x && player.y === cell2.y) {
        if (this.invincible[player.id] > 0) continue;
        if (player.shielded) { player.shielded = false; }
        else { player.alive = false; this.deathOrder.push(player.id); }
      }
    }
  }

  for (var c3 = 0; c3 < cells.length; c3++) {
    var cell3 = cells[c3];
    for (var b = 0; b < this.bombs.length; b++) {
      if (!this.bombs[b].exploded && this.bombs[b].x === cell3.x && this.bombs[b].y === cell3.y) {
        this.explodeBomb(this.bombs[b]);
      }
    }
  }

  this.explosions.push({ cells: cells, startTime: Date.now(), duration: this.config.EXPLOSION_DURATION_MS || 500 });
};

BombermanGame.prototype.processPickups = function() {
  for (var i = 0; i < this.players.length; i++) {
    var player = this.players[i];
    if (!player.alive) continue;
    for (var j = 0; j < this.powerups.length; j++) {
      var pu = this.powerups[j];
      if (pu.x === player.x && pu.y === player.y) {
        pu.apply(player);
        this.powerups.splice(j, 1);
        j--;
      }
    }
  }
};

BombermanGame.prototype.checkWinCondition = function() {
  var alive = [];
  for (var i = 0; i < this.players.length; i++) {
    if (this.players[i].alive) alive.push(this.players[i]);
  }
  if (alive.length <= 1) {
    this.state = 'finished';
    if (alive.length === 1) {
      this.winner = alive[0].id;
      alive[0].rank = 1;
    }
    for (var j = 0; j < this.deathOrder.length; j++) {
      var deadId = this.deathOrder[j];
      for (var k = 0; k < this.players.length; k++) {
        if (this.players[k].id === deadId) {
          this.players[k].rank = this.players.length - j;
          break;
        }
      }
    }
  }
};

BombermanGame.prototype.getRankings = function() {
  var result = [];
  for (var i = 0; i < this.players.length; i++) {
    var p = this.players[i];
    result.push({ id: p.id, nickname: p.nickname, rank: p.rank || 4 });
  }
  result.sort(function(a, b) { return a.rank - b.rank; });
  return result;
};

BombermanGame.prototype.getState = function() {
  var players = [];
  for (var i = 0; i < this.players.length; i++) {
    var p = this.players[i];
    players.push({
      id: p.id, nickname: p.nickname, x: p.x, y: p.y,
      direction: p.direction, alive: p.alive, color: p.color,
      maxBombs: p.maxBombs, activeBombs: p.activeBombs,
      bombRange: p.bombRange, shielded: p.shielded, speed: p.speed
    });
  }
  var bombs = [];
  for (var j = 0; j < this.bombs.length; j++) {
    if (!this.bombs[j].exploded) {
      bombs.push({ id: this.bombs[j].id, x: this.bombs[j].x, y: this.bombs[j].y, ownerId: this.bombs[j].ownerId });
    }
  }
  var now = Date.now();
  var expDuration = this.config.EXPLOSION_DURATION_MS || 500;
  var explosions = [];
  for (var k = 0; k < this.explosions.length; k++) {
    var e = this.explosions[k];
    if (now - e.startTime < expDuration) explosions.push({ cells: e.cells });
  }
  var powerups = [];
  for (var m = 0; m < this.powerups.length; m++) {
    powerups.push({ x: this.powerups[m].x, y: this.powerups[m].y, type: this.powerups[m].type });
  }
  return {
    state: this.state, tick: this.tickCount,
    players: players, bombs: bombs,
    explosions: explosions, powerups: powerups,
    map: this.map, winner: this.winner
  };
};

BombermanGame.prototype.processTimeProgress = function() {
  var newMinutes = Math.floor(this.tickCount / SPEED_INTERVAL);
  if (newMinutes > this.elapsedMinutes) {
    this.elapsedMinutes = newMinutes;
    // Speed up every minute: moveCooldown decreases gradually
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i];
      if (!p.alive) continue;
      // Speed level: 0 at start, increases by 1 each minute (max 4)
      var speedLevel = Math.min(newMinutes, 4);
      p.moveCooldownBase = SPEED_LEVELS[speedLevel];
      // Bomb count: +1 every 2 minutes (max +5 from baseline)
      if (newMinutes % 2 === 0 && newMinutes > 0) {
        p.maxBombs = Math.min(p.maxBombs + 1, 6);
      }
    }
  }
};

module.exports = BombermanGame;
