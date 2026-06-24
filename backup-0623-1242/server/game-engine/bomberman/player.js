var PLAYER_COLORS = ['#e53935', '#43a047', '#1e88e5', '#fb8c00'];
var SPAWN_POSITIONS = [
  { x: 1, y: 1 }, { x: 15, y: 1 },
  { x: 1, y: 15 }, { x: 15, y: 15 }
];

function Player(id, nickname, index) {
  this.id = id;
  this.nickname = nickname;
  this.index = index;
  this.color = PLAYER_COLORS[index % 4];
  this.x = SPAWN_POSITIONS[index].x;
  this.y = SPAWN_POSITIONS[index].y;
  this.direction = 0;
  this.alive = true;
  this.speed = 1;
  this.maxBombs = 1;
  this.activeBombs = 0;
  this.bombRange = 2;
  this.shielded = false;
  this.rank = 4;
}

module.exports = { Player: Player, PLAYER_COLORS: PLAYER_COLORS, SPAWN_POSITIONS: SPAWN_POSITIONS };
