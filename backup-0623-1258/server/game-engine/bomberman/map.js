const TILE = { EMPTY: 0, HARD: 1, SOFT: 2, SPAWN: 3 };

function generateMap(width, height) {
  var map = [];
  for (var y = 0; y < height; y++) {
    map[y] = [];
    for (var x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        map[y][x] = TILE.HARD;
      } else if (y % 2 === 0 && x % 2 === 0) {
        map[y][x] = TILE.HARD;
      } else {
        map[y][x] = TILE.EMPTY;
      }
    }
  }

  // Mark spawn zones (3x3 around each spawn point)
  var spawns = [
    { x: 1, y: 1 }, { x: width - 2, y: 1 },
    { x: 1, y: height - 2 }, { x: width - 2, y: height - 2 }
  ];
  for (var si = 0; si < spawns.length; si++) {
    var s = spawns[si];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var nx = s.x + dx;
        var ny = s.y + dy;
        if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
          map[ny][nx] = TILE.SPAWN;
        }
      }
    }
  }

  // Fill non-spawn empty cells with soft bricks
  for (var y = 1; y < height - 1; y++) {
    for (var x = 1; x < width - 1; x++) {
      if (map[y][x] === TILE.EMPTY && Math.random() < 0.55) {
        map[y][x] = TILE.SOFT;
      }
    }
  }

  // Convert spawn tiles back to empty
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      if (map[y][x] === TILE.SPAWN) {
        map[y][x] = TILE.EMPTY;
      }
    }
  }

  return { map: map, width: width, height: height };
}

module.exports = { generateMap: generateMap, TILE: TILE };
