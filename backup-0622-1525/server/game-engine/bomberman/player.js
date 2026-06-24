const PLAYER_COLORS = ['#e53935', '#43a047', '#1e88e5', '#fb8c00'];
const SPAWN_POSITIONS = [
  { x: 1, y: 1 }, { x: 15, y: 1 },
  { x: 1, y: 15 }, { x: 15, y: 15 }
];

class Player {
  constructor(id, nickname, index) {
    this.id = id;
    this.nickname = nickname;
    this.index = index;
    this.color = PLAYER_COLORS[index % 4];
    this.x = SPAWN_POSITIONS[index].x;
    this.y = SPAWN_POSITIONS[index].y;
    this.direction = 0; // 0=down, 1=up, 2=left, 3=right
    this.alive = true;
    this.speed = 1; // �?tick 移动 1 格（简化版走格子）
    this.maxBombs = 1;
    this.activeBombs = 0;
    this.bombRange = 2;
    this.shielded = false;
    this.moveCooldown = 0; // 移动冷却计数
  }
}

module.exports = { Player, PLAYER_COLORS, SPAWN_POSITIONS };
