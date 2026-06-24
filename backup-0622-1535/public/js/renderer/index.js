// Canvas 游戏渲染�?class GameRenderer {
  constructor(canvas, gridSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gridSize = gridSize;
  }

  init(mapWidth, mapHeight) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.canvas.width = mapWidth * this.gridSize;
    this.canvas.height = mapHeight * this.gridSize;
  }

  render(state) {
    const ctx = this.ctx;
    const gs = this.gridSize;

    // 清除画布
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制地图
    this.renderMap(state.map);

    // 绘制道具
    if (state.powerups) {
      for (const pu of state.powerups) {
        this.renderPowerup(pu);
      }
    }

    // 绘制炸弹
    if (state.bombs) {
      for (const bomb of state.bombs) {
        this.renderBomb(bomb);
      }
    }

    // 绘制爆炸
    if (state.explosions) {
      for (const exp of state.explosions) {
        this.renderExplosion(exp);
      }
    }

    // 绘制玩家
    if (state.players) {
      for (const player of state.players) {
        if (player.alive) this.renderPlayer(player);
      }
    }
  }

  renderMap(map) {
    const ctx = this.ctx;
    const gs = this.gridSize;

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x];
        if (tile === 1) {
          // 硬砖
          ctx.fillStyle = '#555';
          ctx.fillRect(x * gs, y * gs, gs, gs);
          ctx.strokeStyle = '#444';
          ctx.strokeRect(x * gs, y * gs, gs, gs);
          // 硬砖纹理
          ctx.fillStyle = '#666';
          ctx.fillRect(x * gs + 4, y * gs + 4, 4, 4);
          ctx.fillRect(x * gs + gs - 8, y * gs + gs - 8, 4, 4);
        } else if (tile === 2) {
          // 软砖
          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(x * gs, y * gs, gs, gs);
          ctx.strokeStyle = '#6d4c41';
          ctx.strokeRect(x * gs, y * gs, gs, gs);
          // 砖纹
          ctx.fillStyle = '#a1887f';
          ctx.fillRect(x * gs + 6, y * gs + 4, gs - 12, 3);
          ctx.fillRect(x * gs + 4, y * gs + gs/2, gs - 8, 3);
        } else {
          // 空地
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(x * gs, y * gs, gs, gs);
          // 网格�?          ctx.strokeStyle = '#333';
          ctx.strokeRect(x * gs, y * gs, gs, gs);
        }
      }
    }
  }

  renderPlayer(player) {
    const ctx = this.ctx;
    const gs = this.gridSize;
    const cx = player.x * gs + gs / 2;
    const cy = player.y * gs + gs / 2;
    const r = gs / 2 - 4;

    // 身体（圆形）
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 方向指示（小三角形）
    const dirAngle = [0, Math.PI, Math.PI / 2, -Math.PI / 2][player.direction || 0];
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(dirAngle) * (r + 2), cy + Math.sin(dirAngle) * (r + 2));
    ctx.lineTo(cx + Math.cos(dirAngle + 0.4) * (r - 2), cy + Math.sin(dirAngle + 0.4) * (r - 2));
    ctx.lineTo(cx + Math.cos(dirAngle - 0.4) * (r - 2), cy + Math.sin(dirAngle - 0.4) * (r - 2));
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();

    // 有护盾则画光�?    if (player.shielded) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (player.speed > 1) {
      ctx.fillStyle = 'rgba(255,255,100,0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.fill();
  }

  renderBomb(bomb) {
    const ctx = this.ctx;
    const gs = this.gridSize;
    const cx = bomb.x * gs + gs / 2;
    const cy = bomb.y * gs + gs / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, gs / 2 - 6, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 引信火花
    const sparkSize = 3 + Math.sin(Date.now() / 100) * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, sparkSize, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5722';
    ctx.fill();
  }

  renderExplosion(exp) {
    const ctx = this.ctx;
    const gs = this.gridSize;
    for (const cell of exp.cells) {
      const gradient = ctx.createRadialGradient(
        cell.x * gs + gs / 2, cell.y * gs + gs / 2, 0,
        cell.x * gs + gs / 2, cell.y * gs + gs / 2, gs / 2
      );
      gradient.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(cell.x * gs, cell.y * gs, gs, gs);
    }
  }

  renderPowerup(pu) {
    const ctx = this.ctx;
    const gs = this.gridSize;
    const cx = pu.x * gs + gs / 2;
    const cy = pu.y * gs + gs / 2;

    // 闪光效果
    ctx.font = `${gs - 10}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.type.label, cx, cy);
  }
}
