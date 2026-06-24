// 炸弹逻辑
class Bomb {
  constructor(id, ownerId, x, y, range, fuseMs) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.range = range;
    this.plantedAt = Date.now();
    this.fuseMs = fuseMs;
    this.exploded = false;
    this.explosionCells = []; // 爆炸覆盖的格子
    this.explosionStartTime = 0;
  }

  shouldExplode() {
    return !this.exploded && (Date.now() - this.plantedAt >= this.fuseMs);
  }

  // 计算爆炸范围
  calculateExplosion(mapData) {
    const cells = [{ x: this.x, y: this.y }];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const { map, width, height } = mapData;

    for (const [dx, dy] of dirs) {
      for (let i = 1; i <= this.range; i++) {
        const nx = this.x + dx * i;
        const ny = this.y + dy * i;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) break;
        if (map[ny][nx] === 1) break; // 硬砖阻挡
        cells.push({ x: nx, y: ny });
        if (map[ny][nx] === 2) break; // 软砖被炸，停止扩散
      }
    }
    return cells;
  }
}

let bombIdCounter = 0;
function nextBombId() { return ++bombIdCounter; }

module.exports = { Bomb, nextBombId };
