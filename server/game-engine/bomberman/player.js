var PLAYER_COLORS = ['#e53935', '#43a047', '#1e88e5', '#fb8c00'];

function getSpawnPositions(mapSize) {
  var s = mapSize || 21;
  return [
    { x: 1, y: 1 },
    { x: s - 2, y: 1 },
    { x: 1, y: s - 2 },
    { x: s - 2, y: s - 2 }
  ];
}

function Player(id, nickname, index, opts) {
  opts = opts || {};
  var mapSize = opts.mapSize || 21;
  var spawns = getSpawnPositions(mapSize);
  this.id = id;
  this.nickname = nickname;
  this.index = index;
  this.color = PLAYER_COLORS[index % 4];
  this.x = spawns[index] ? spawns[index].x : 1;
  this.y = spawns[index] ? spawns[index].y : 1;
  this.direction = 0;
  this.alive = true;
  this.speed = 1;
  this.maxBombs = 1;
  this.activeBombs = 0;
  this.bombRange = 2;
  this.shielded = false;
  this.rank = 4;
  this.game_character = opts.game_character || 'stick';
  this.avatar = opts.avatar || 'default';
  this.kicker = false;
  this.disconnected = false;
}

module.exports = { Player: Player, PLAYER_COLORS: PLAYER_COLORS };
