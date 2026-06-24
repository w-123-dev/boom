// 道具
const POWERUP_TYPES = {
  BOMB_UP: { id: 'bomb_up', label: '💣+', desc: '炸弹数+1', weight: 25 },
  FIRE_UP: { id: 'fire_up', label: '🔥+', desc: '爆炸范围+1', weight: 25 },
  SPEED_UP: { id: 'speed_up', label: '⚡', desc: '移速提升', weight: 20 },
  SHIELD: { id: 'shield', label: '🛡️', desc: '护盾抵挡一次', weight: 10 },
  KICK: { id: 'kick', label: '👟', desc: '踢炸弹', weight: 15 },
  SKULL: { id: 'skull', label: '💀', desc: '减速', weight: 5 }
};

const POWERUP_LIST = Object.values(POWERUP_TYPES);

function rollPowerup() {
  const totalWeight = POWERUP_LIST.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * totalWeight;
  for (const p of POWERUP_LIST) {
    r -= p.weight;
    if (r <= 0) return { ...p };
  }
  return { ...POWERUP_LIST[0] };
}

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
  }

  apply(player) {
    switch (this.type.id) {
      case 'bomb_up': player.maxBombs = Math.min(player.maxBombs + 1, 8); break;
      case 'fire_up': player.bombRange = Math.min(player.bombRange + 1, 8); break;
      case 'speed_up': player.speed = Math.min(player.speed + 1, 3); break;
      case 'shield': player.shielded = true; break;
      case 'skull': player.speed = Math.max(player.speed - 1, 1); break;
      // kick 需要额外逻辑
    }
  }
}

module.exports = { PowerUp, rollPowerup, POWERUP_TYPES };
