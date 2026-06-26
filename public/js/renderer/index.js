// Enhanced game canvas renderer
const THEMES = {
  default: {
    name: '暗黑地牢',
    floor: ['#1a1a2e', '#1e1e32'],
    floorAccent: 'rgba(79,195,247,0.06)',
    hardWall: { fill: '#3a3a50', stroke: '#2a2a3e', pattern: '#4a4a60', highlight: 'rgba(255,255,255,0.05)' },
    softBrick: { grad: ['#9d7e73','#8d6e63','#7d5e53'], stroke: '#5d3a2a', hl: 'rgba(255,255,255,0.07)' },
    bomb: { body: ['#555','#222','#111'], stroke: '#444', fuse: '#ff6d00', fuseInner: '#ffab00' },
    explosion: { outer: ['rgba(255,200,50,0.6)','rgba(255,100,0,0.4)','rgba(255,50,0,0.2)','rgba(255,0,0,0)'], innerBase: 'rgba(255,255,200,', innerMid: 'rgba(255,150,0,', innerEnd: 'rgba(255,50,0,0)', particle: 'rgba(255,200,50,' },
    powerupGlow: '#ffd54f'
  },
  ice: {
    name: '冰雪世界',
    floor: ['#dcecf5', '#e6f2f8'],
    floorAccent: 'rgba(100,200,255,0.08)',
    hardWall: { fill: '#5090b0', stroke: '#4078a0', pattern: '#60a0c0', highlight: 'rgba(255,255,255,0.15)' },
    softBrick: { grad: ['#c8e0f0','#b8d4e8','#a8c8de'], stroke: '#80b0cc', hl: 'rgba(255,255,255,0.2)' },
    bomb: { body: ['#4a7a90','#3a6a80','#2a5a70'], stroke: '#3a6a80', fuse: '#b0e0ff', fuseInner: '#ffffff' },
    explosion: { outer: ['rgba(200,230,255,0.5)','rgba(150,200,255,0.3)','rgba(100,170,255,0.15)','rgba(50,140,255,0)'], innerBase: 'rgba(255,255,255,', innerMid: 'rgba(200,230,255,', innerEnd: 'rgba(100,180,255,0)', particle: 'rgba(200,230,255,' },
    powerupGlow: '#87ceeb'
  },
  volcano: {
    name: '火山炼狱',
    floor: ['#2c1410', '#3e1e18'],
    floorAccent: 'rgba(255,150,50,0.06)',
    hardWall: { fill: '#5a4840', stroke: '#4a3830', pattern: '#6a5850', highlight: 'rgba(255,200,100,0.06)' },
    softBrick: { grad: ['#d47a30','#c86a28','#bc5e20'], stroke: '#a05010', hl: 'rgba(255,220,150,0.15)' },
    bomb: { body: ['#8a4a2a','#6a3a1a','#4a2a0a'], stroke: '#5a3010', fuse: '#ff6d00', fuseInner: '#ffcc00' },
    explosion: { outer: ['rgba(255,200,50,0.7)','rgba(255,100,0,0.5)','rgba(255,50,0,0.3)','rgba(200,0,0,0)'], innerBase: 'rgba(255,255,200,', innerMid: 'rgba(255,200,0,', innerEnd: 'rgba(255,100,0,0)', particle: 'rgba(255,200,50,' },
    powerupGlow: '#ff8c00'
  }
};

class GameRenderer {
  constructor(canvas, gridSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gridSize = gridSize || 40;
    this.mapWidth = 0;
    this.mapHeight = 0;
    this.customAvatars = {};
    this.tick = 0;
    this.theme = THEMES.default;
  }

  setTheme(themeName) {
    this.theme = THEMES[themeName] || THEMES.default;
  }

  init(mapWidth, mapHeight) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.canvas.width = mapWidth * this.gridSize;
    this.canvas.height = mapHeight * this.gridSize;
  }

  render(state) {
    this.tick++;
    var ctx = this.ctx;
    var gs = this.gridSize;
    var t = this.theme;

    ctx.fillStyle = t.floor[0];
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderMap(state.map);
    if (state.powerups) {
      for (var i = 0; i < state.powerups.length; i++) {
        this.renderPowerup(state.powerups[i]);
      }
    }
    if (state.bombs) {
      for (var j = 0; j < state.bombs.length; j++) {
        this.renderBomb(state.bombs[j]);
      }
    }
    if (state.explosions) {
      for (var k = 0; k < state.explosions.length; k++) {
        this.renderExplosion(state.explosions[k]);
      }
    }
    if (state.players) {
      for (var m = 0; m < state.players.length; m++) {
        if (state.players[m].alive) this.renderPlayer(state.players[m]);
      }
    }
  }

  renderMap(map) {
    var ctx = this.ctx;
    var gs = this.gridSize;
    var t = this.theme;
    for (var y = 0; y < map.length; y++) {
      for (var x = 0; x < map[y].length; x++) {
        var tile = map[y][x];
        var px = x * gs, py = y * gs;

        if (tile === 1) {
          // Indestructible wall - bold pattern
          ctx.fillStyle = t.hardWall.fill;
          ctx.fillRect(px, py, gs, gs);
          // Outer border
          ctx.strokeStyle = t.hardWall.stroke;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px, py, gs, gs);
          // Cross pattern (more visible)
          ctx.strokeStyle = t.hardWall.pattern;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + gs - 4, py + gs - 4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px + gs - 4, py + 4); ctx.lineTo(px + 4, py + gs - 4); ctx.stroke();
          // Center dot
          ctx.fillStyle = t.hardWall.pattern;
          ctx.beginPath(); ctx.arc(px + gs/2, py + gs/2, 4, 0, Math.PI*2); ctx.fill();
          // Top highlight
          ctx.fillStyle = t.hardWall.highlight;
          ctx.fillRect(px + 2, py + 2, gs - 4, 2);

        } else if (tile === 2) {
          // Destructible brick - warm/gradient with clear brick lines
          var grad = ctx.createLinearGradient(px, py, px + gs, py + gs);
          grad.addColorStop(0, t.softBrick.grad[0]);
          grad.addColorStop(1, t.softBrick.grad[2]);
          ctx.fillStyle = grad;
          ctx.fillRect(px, py, gs, gs);
          // Brick outline
          ctx.strokeStyle = t.softBrick.stroke;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px, py, gs, gs);
          // Inner brick lines - half grid
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(px, py + gs/2); ctx.lineTo(px + gs, py + gs/2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px + gs/2, py); ctx.lineTo(px + gs/2, py + gs/2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px + gs/4, py + gs/2); ctx.lineTo(px + gs/4, py + gs); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px + gs*3/4, py + gs/2); ctx.lineTo(px + gs*3/4, py + gs); ctx.stroke();
          // Top highlight
          ctx.fillStyle = t.softBrick.hl;
          ctx.fillRect(px + 2, py + 2, gs - 4, 2);

        } else {
          // Floor tile with checkerboard
          var isEven = (x + y) % 2 === 0;
          ctx.fillStyle = isEven ? t.floor[0] : t.floor[1];
          ctx.fillRect(px, py, gs, gs);
        }
      }
    }
  }

  renderPlayer(player) {
    var gc = player.game_character || 'stick';
    var av = player.avatar || 'default';
    if (av.indexOf('/uploads/') === 0) return this.renderCustomAvatar(player, av);
    if (gc === 'circle') this.renderCircle(player);
    else if (gc === 'square') this.renderSquare(player);
    else if (gc === 'triangle') this.renderTri(player);
    else this.renderStick(player);
  }

  renderStick(p) {
    var ctx=this.ctx, gs=this.gridSize, cx=p.x*gs+gs/2, cy=p.y*gs+gs/2, d=p.direction||0;
    var st=Math.sin(this.tick*0.1+(p.id||0)*3)*3;
    if (p.shielded) { ctx.shadowColor=p.color; ctx.shadowBlur=15; }
    ctx.strokeStyle=p.color; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(cx,cy-10,5,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); ctx.stroke();
    var eo=[0,0,-2,2][d]; var eo2=[2,-2,0,0][d];
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx+eo-2+eo2,cy-11+eo2,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+eo+2+eo2,cy-11+eo2,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx,cy-5); ctx.lineTo(cx,cy+6); ctx.stroke();
    var aa=[0.5,-0.5,1.0,-1.0][d]; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(cx,cy-2); ctx.lineTo(cx-7+st*0.5,cy-2+aa*3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy-2); ctx.lineTo(cx+7-st*0.5,cy-2-aa*3); ctx.stroke();
    ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(cx,cy+6); ctx.lineTo(cx-5+st,cy+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy+6); ctx.lineTo(cx+5-st,cy+14); ctx.stroke();
    ctx.shadowBlur=0;
    if(p.shielded)this.renderFX(cx,cy);
    if(p.speed>1)this.renderSpeed(cx,cy);
  }

  renderCircle(p) {
    var ctx=this.ctx, gs=this.gridSize, cx=p.x*gs+gs/2, cy=p.y*gs+gs/2, r=gs/2-4, d=p.direction||0;
    if (p.shielded) { ctx.shadowColor=p.color; ctx.shadowBlur=15; }
    var grad = ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,2,cx,cy,r);
    grad.addColorStop(0, '#fff'); grad.addColorStop(0.3, p.color); grad.addColorStop(1, p.color);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=2; ctx.stroke();
    ctx.shadowBlur=0;
    var da=[0,Math.PI,Math.PI/2,-Math.PI/2][d];
    ctx.beginPath(); ctx.arc(cx+Math.cos(da)*r*0.5,cy+Math.sin(da)*r*0.5,4,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fill();
    if(p.shielded)this.renderFX(cx,cy);
    if(p.speed>1)this.renderSpeed(cx,cy);
  }

  renderSquare(p) {
    var ctx=this.ctx, gs=this.gridSize, cx=p.x*gs+gs/2, cy=p.y*gs+gs/2, s=gs/2-4;
    if (p.shielded) { ctx.shadowColor=p.color; ctx.shadowBlur=15; }
    var grad = ctx.createLinearGradient(cx-s,cy-s,cx+s,cx+s);
    grad.addColorStop(0, p.color); grad.addColorStop(1, p.color);
    ctx.fillStyle=grad; ctx.fillRect(cx-s,cy-s,s*2,s*2);
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=2; ctx.strokeRect(cx-s,cy-s,s*2,s*2);
    ctx.shadowBlur=0;
    var d=p.direction||0, dx=[0,0,-1,1][d], dy=[1,-1,0,0][d];
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(cx+dx*6,cy+dy*6,3,0,Math.PI*2); ctx.fill();
    if(p.shielded)this.renderFX(cx,cy);
    if(p.speed>1)this.renderSpeed(cx,cy);
  }

  renderTri(p) {
    var ctx=this.ctx, gs=this.gridSize, cx=p.x*gs+gs/2, cy=p.y*gs+gs/2, r=gs/2-2, d=p.direction||0;
    if (p.shielded) { ctx.shadowColor=p.color; ctx.shadowBlur=15; }
    var da=[Math.PI/2,-Math.PI/2,Math.PI,0][d];
    ctx.beginPath();
    for(var i=0;i<3;i++){var a=da+i*2*Math.PI/3;var px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    ctx.closePath();
    var grad = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, p.color); grad.addColorStop(1, p.color);
    ctx.fillStyle=grad; ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=2; ctx.stroke();
    ctx.shadowBlur=0;
    var ed = d === 0 ? 0 : d === 1 ? 0 : d === 2 ? -3 : 3;
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(cx+ed,cy-3,3,0,Math.PI*2); ctx.fill();
    if(p.shielded)this.renderFX(cx,cy);
    if(p.speed>1)this.renderSpeed(cx,cy);
  }

  renderFX(cx,cy){
    var ctx=this.ctx;
    ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(cx,cy,16,0,Math.PI*2);
    ctx.strokeStyle='rgba(100,200,255,' + (0.3 + Math.sin(this.tick*0.1)*0.2) + ')';
    ctx.lineWidth=2; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
  }

  renderSpeed(cx,cy){
    var ctx=this.ctx;
    ctx.fillStyle='rgba(255,235,59,' + (0.2 + Math.sin(this.tick*0.15)*0.1) + ')';
    ctx.beginPath(); ctx.arc(cx,cy,13,0,Math.PI*2); ctx.fill();
  }

  renderBomb(bomb) {
    var ctx = this.ctx;
    var gs = this.gridSize;
    var t = this.theme;
    var cx = bomb.x * gs + gs / 2;
    var cy = bomb.y * gs + gs / 2;
    var r = gs / 2 - 5;
    var pulse = 1 + Math.sin(this.tick * 0.15) * 0.08;
    var grad = ctx.createRadialGradient(cx-2,cy-2,2,cx,cy,r*pulse);
    grad.addColorStop(0, t.bomb.body[0]);
    grad.addColorStop(0.7, t.bomb.body[1]);
    grad.addColorStop(1, t.bomb.body[2]);
    ctx.beginPath(); ctx.arc(cx, cy, r*pulse, 0, Math.PI*2);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = t.bomb.stroke; ctx.lineWidth = 1.5; ctx.stroke();
    var sparkSize = 2 + Math.sin(this.tick * 0.2) * 1.5;
    ctx.beginPath(); ctx.arc(cx, cy - r*pulse + 3, sparkSize, 0, Math.PI*2);
    ctx.fillStyle = t.bomb.fuse; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - r*pulse + 3, sparkSize*0.5, 0, Math.PI*2);
    ctx.fillStyle = t.bomb.fuseInner; ctx.fill();
  }

  renderExplosion(exp) {
    var ctx = this.ctx;
    var gs = this.gridSize;
    var t = this.theme;
    var tick = this.tick;
    for (var i = 0; i < exp.cells.length; i++) {
      var cell = exp.cells[i];
      var px = cell.x * gs, py = cell.y * gs;
      var cx = px + gs/2, cy = py + gs/2;
      var grad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, gs*0.8);
      grad1.addColorStop(0, t.explosion.outer[0]);
      grad1.addColorStop(0.3, t.explosion.outer[1]);
      grad1.addColorStop(0.6, t.explosion.outer[2]);
      grad1.addColorStop(1, t.explosion.outer[3]);
      ctx.fillStyle = grad1;
      ctx.fillRect(px - gs*0.3, py - gs*0.3, gs*1.6, gs*1.6);
      var flicker = 0.8 + Math.sin(tick * 0.3 + i) * 0.2;
      var grad2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, gs*0.4);
      grad2.addColorStop(0, t.explosion.innerBase + (0.9*flicker) + ')');
      grad2.addColorStop(0.4, t.explosion.innerMid + (0.7*flicker) + ')');
      grad2.addColorStop(1, t.explosion.innerEnd);
      ctx.fillStyle = grad2;
      ctx.fillRect(px, py, gs, gs);
      for (var pi = 0; pi < 3; pi++) {
        var angle = (tick * 0.5 + i * 2 + pi * 2.1) % (Math.PI * 2);
        var dist = gs * 0.2 + Math.sin(tick * 0.2 + pi * 5) * gs * 0.15;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 2, 0, Math.PI*2);
        ctx.fillStyle = t.explosion.particle + (0.5 + Math.sin(tick*0.2+pi)*0.3) + ')';
        ctx.fill();
      }
    }
  }

  renderCustomAvatar(p, url) {
    var self = this, ctx = this.ctx, gs = this.gridSize;
    var cx = p.x * gs + gs / 2, cy = p.y * gs + gs / 2, r = gs / 2 - 2;
    var name = p.nickname || '?';
    if (!this.customAvatars[url]) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() { self.customAvatars[url] = img; };
      img.onerror = function() { self.customAvatars[url] = 'failed'; };
      img.src = url;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
      ctx.fillText(name, cx, cy + r + 12);
      return;
    }
    if (this.customAvatars[url] === 'failed') return this.renderStick(p);
    var img = this.customAvatars[url];
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = p.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
    ctx.fillText(name, cx, cy + r + 12);
    if (p.shielded) this.renderFX(cx, cy);
    if (p.speed > 1) this.renderSpeed(cx, cy);
  }

  renderPowerup(pu) {
    var ctx = this.ctx;
    var gs = this.gridSize;
    var t = this.theme;
    var cx = pu.x * gs + gs / 2;
    var cy = pu.y * gs + gs / 2;
    var pulse = 1 + Math.sin(this.tick * 0.08) * 0.1;
    var s = gs/2 - 1;
    // Diamond shape with glow
    ctx.shadowColor = t.powerupGlow;
    ctx.shadowBlur = 14;
    // Draw a diamond (rotated square for powerup)
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * pulse);
    ctx.lineTo(cx + s * pulse, cy);
    ctx.lineTo(cx, cy + s * pulse);
    ctx.lineTo(cx - s * pulse, cy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = t.powerupGlow;
    ctx.lineWidth = 3;
    ctx.stroke();
    // Emoji icon
    ctx.font = (gs - 10) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.type.label, cx, cy + 1);
  }
}
