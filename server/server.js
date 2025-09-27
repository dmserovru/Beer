const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT || '3003', 10);
const TICK_RATE = parseInt(process.env.TICK_RATE || '60', 10);
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '100', 100);
const RESPAWN_TIME = parseInt(process.env.RESPAWN_TIME || '10000', 10);
const MAX_HP = 100;
const WORLD_SIZE = { width: 800, height: 600 };
const POWER_UP_DURATION = 10000;
const POWER_UP_RESPAWN_TIME = 20000;
const MAX_POWER_UPS = 5;
const SWING_COOLDOWN = 2000;

const HILL_RADIUS = 100;
const HILL_SCORE_RATE = 25;
const HILL_MOVE_INTERVAL = 45000;

function generateGridPositions(count, width, height) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const positions = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col + 0.5) * cellWidth + (Math.random() - 0.5) * cellWidth * 0.6;
    const y = (row + 0.5) * cellHeight + (Math.random() - 0.5) * cellHeight * 0.6;
    positions.push({ x: Math.floor(x), y: Math.floor(y) });
  }

  return positions;
}

const POWER_UP_SPAWN_LOCATIONS = generateGridPositions(6, 800, 600);

const walls = generateGridPositions(8, 800, 600).map(pos => ({
  x: pos.x,
  y: pos.y,
  width: 20 + Math.random() * 60,
  height: 20 + Math.random() * 60,
  angle: Math.random() * 90
}));
const bushes = generateGridPositions(6, 800, 600);
const trees = generateGridPositions(6, 800, 600);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'client')));

let players = {};
let projectiles = [];
let powerUps = {};
let nextPowerUpId = 0;

let hillZone = {};
let hillController = null;
let isContested = false;
let kingOfTheHill = null;

function createPlayer(id, name) {
  return {
    id,
    name: name || 'Player',
    x: Math.floor(Math.random() * WORLD_SIZE.width),
    y: Math.floor(Math.random() * WORLD_SIZE.height),
    vx: 0,
    vy: 0,
    hp: MAX_HP,
    score: 0,
    kills: 0,
    damageDealt: 0,
    alive: true,
    respawnAt: null,
    lastInputSeq: 0,
    lastDirection: { x: 0, y: 0 },
    activePowerUp: null,
    powerUpTimer: 0,
    lastSwingTime: 0,
    hillTime: 0
  };
}

function sanitizeName(n) {
  if (!n) return 'Player';
  return String(n).substring(0, 20).replace(/[<>\/:"\\|?*]/g, '');
}

function scrubPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    x: Math.round(p.x),
    y: Math.round(p.y),
    hp: p.hp,
    score: p.score,
    alive: p.alive,
    lastDirection: p.lastDirection
  };
}

function checkWallCollision(x, y, radius = 22) {
  for (const wall of walls) {
    const cos = Math.cos(wall.angle * Math.PI / 180);
    const sin = Math.sin(wall.angle * Math.PI / 180);
    const localX = (x - wall.x) * cos + (y - wall.y) * sin;
    const localY = -(x - wall.x) * sin + (y - wall.y) * cos;
    if (Math.abs(localX) < wall.width / 2 + radius && Math.abs(localY) < wall.height / 2 + radius) {
      return true;
    }
  }
  return false;
}

function checkProjectileWallCollision(x, y, radius = 8) {
  for (const wall of walls) {
    const cos = Math.cos(wall.angle * Math.PI / 180);
    const sin = Math.sin(wall.angle * Math.PI / 180);
    const localX = (x - wall.x) * cos + (y - wall.y) * sin;
    const localY = -(x - wall.x) * sin + (y - wall.y) * cos;
    if (Math.abs(localX) < wall.width / 2 + radius && Math.abs(localY) < wall.height / 2 + radius) {
      return true;
    }
  }
  return false;
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', ({ name }) => {
    if (Object.keys(players).length >= MAX_PLAYERS) {
      socket.emit('joinError', { message: 'Room full' });
      return;
    }
    const p = createPlayer(socket.id, sanitizeName(name));
    players[socket.id] = p;
    socket.emit('joined', {
      id: socket.id,
      self: scrubPlayer(p),
      walls: walls,
      bushes: bushes,
      trees: trees,
      worldSize: WORLD_SIZE,
      powerUps: Object.values(powerUps),
      hillZone: hillZone
    });
    io.emit('playerJoined', { player: scrubPlayer(p) });
    console.log('player joined:', p.name);
  });

  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;

    p.lastInputSeq = data.seq || p.lastInputSeq;

    const speed = p.activePowerUp === 'speed' ? 300 : 200;
    let vx = 0, vy = 0;
    if (data.left) vx -= 1;
    if (data.right) vx += 1;
    if (data.up) vy -= 1;
    if (data.down) vy += 1;

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
      p.lastDirection = { x: vx / speed, y: vy / speed };
    } else {
      vx = 0;
      vy = 0;
    }

    p.vx = vx;
    p.vy = vy;

    if (data.action === 'swing') {
      const now = Date.now();
      if (now - p.lastSwingTime > SWING_COOLDOWN) {
        p.lastSwingTime = now;

        const speed = 250;
        let vx = p.lastDirection.x * speed;
        let vy = p.lastDirection.y * speed;

        if (vx === 0 && vy === 0) {
          vx = speed;
        }

        const bottle = {
          id: Math.random().toString(36).substring(7),
          playerId: socket.id,
          x: p.x,
          y: p.y,
          vx: vx,
          vy: vy,
          type: 'bottle',
          createdAt: Date.now()
        };
        projectiles.push(bottle);
        io.emit('projectileCreated', bottle);
      }
    }
  });

  socket.on('shoot', (data) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;

    const projectile = {
      id: Math.random().toString(36).substring(7),
      localId: data.localId,
      playerId: socket.id,
      x: data.x,
      y: data.y,
      vx: data.vx,
      vy: data.vy,
      createdAt: Date.now()
    };

    projectiles.push(projectile);
    io.emit('projectileCreated', projectile);
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      console.log('player left:', p.name);
      delete players[socket.id];
      io.emit('playerLeft', { id: socket.id });
    }
  });
});

function handleHit(attackerId, targetId, data) {
  const attacker = players[attackerId];
  const target = players[targetId];
  if (!attacker || !target) return;
  if (!attacker.alive || !target.alive) return;

  const ax = (typeof data.ax === 'number') ? data.ax : attacker.x;
  const ay = (typeof data.ay === 'number') ? data.ay : attacker.y;
  const dx = ax - target.x;
  const dy = ay - target.y;
  const dist = Math.hypot(dx, dy);
  const MAX_HIT_RANGE = 120;
  if (dist > MAX_HIT_RANGE) return;

  const DAMAGE = attacker.activePowerUp === 'damage' ? 68 : 34;
  target.hp -= DAMAGE;
  attacker.score += 10;
  attacker.damageDealt += DAMAGE;

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.respawnAt = Date.now() + RESPAWN_TIME;
    attacker.kills += 1;
    attacker.score += 50;
    io.emit('playerDied', { id: target.id, by: attacker.id });
  }
}

let lastUpdate = Date.now();
let lastStateBroadcast = 0;
const STATE_BROADCAST_RATE = 20;
const PROJECTILE_LIFETIME = 3000;

setInterval(() => {
  const now = Date.now();
  const dt = (now - lastUpdate) / 1000;
  lastUpdate = now;

  for (const id in players) {
    const p = players[id];
    if (p.alive) {
      const vel_x = p.vx;
      const vel_y = p.vy;

      let next_x = p.x + vel_x * dt;
      if (checkWallCollision(next_x, p.y)) {
        p.vx = 0;
      } else {
        p.x = next_x;
      }

      let next_y = p.y + vel_y * dt;
      if (checkWallCollision(p.x, next_y)) {
        p.vy = 0;
      } else {
        p.y = next_y;
      }

      p.x = Math.max(0, Math.min(WORLD_SIZE.width, p.x));
      p.y = Math.max(0, Math.min(WORLD_SIZE.height, p.y));

      for (const id2 in powerUps) {
        const powerUp = powerUps[id2];
        const dx = p.x - powerUp.x;
        const dy = p.y - powerUp.y;
        if (Math.hypot(dx, dy) < 30) {
          p.activePowerUp = powerUp.type;
          p.powerUpTimer = Date.now() + POWER_UP_DURATION;
          delete powerUps[id2];
          io.emit('powerUpCollected', { powerUpId: id2, playerId: p.id });
          setTimeout(() => spawnPowerUp(), POWER_UP_RESPAWN_TIME);
        }
      }

      if (p.powerUpTimer && now > p.powerUpTimer) {
        p.activePowerUp = null;
        p.powerUpTimer = 0;
      }

      const playersInHill = Object.values(players).filter(p => p.alive && Math.hypot(p.x - hillZone.x, p.y - hillZone.y) < HILL_RADIUS);
      if (playersInHill.length === 1) {
        const controller = playersInHill[0];
        if (hillController !== controller.id) {
          hillController = controller.id;
        }
        controller.score += (HILL_SCORE_RATE * dt);
        controller.hillTime += dt;
        isContested = false;
        const currentKing = players[kingOfTheHill];
        if (!currentKing || controller.hillTime > currentKing.hillTime) {
          kingOfTheHill = controller.id;
        }
      } else {
        hillController = null;
        isContested = playersInHill.length > 1;
      }
    } else {
      if (p.respawnAt && now >= p.respawnAt) {
        p.x = Math.floor(Math.random() * WORLD_SIZE.width);
        p.y = Math.floor(Math.random() * WORLD_SIZE.height);
        p.hp = MAX_HP;
        p.alive = true;
        p.respawnAt = null;
        io.to(p.id).emit('respawned');
      }
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    const lifetime = proj.type === 'bottle' ? 1000 : PROJECTILE_LIFETIME;
    let shattered = false;

    if (checkProjectileWallCollision(proj.x, proj.y)) {
      if (proj.type === 'bottle') shattered = true;
      else {
        io.emit('projectileDestroyed', { id: proj.id });
        projectiles.splice(i, 1);
        continue;
      }
    }

    if (now - proj.createdAt > lifetime) {
      if (proj.type === 'bottle') shattered = true;
      else {
        io.emit('projectileDestroyed', { id: proj.id });
        projectiles.splice(i, 1);
        continue;
      }
    }

    if (shattered) {
      const BOTTLE_AOE_DAMAGE = 25;
      const BOTTLE_AOE_RADIUS = 60;
      Object.values(players).forEach(p => {
        if (p.alive && Math.hypot(p.x - proj.x, p.y - proj.y) < BOTTLE_AOE_RADIUS) {
          p.hp -= BOTTLE_AOE_DAMAGE;
          const attacker = players[proj.playerId];
          if (attacker) {
            attacker.score += 5;
            attacker.damageDealt += BOTTLE_AOE_DAMAGE;
          }
          if (p.hp <= 0) {
            p.hp = 0;
            p.alive = false;
            p.respawnAt = now + RESPAWN_TIME;
            if (attacker) attacker.kills += 1;
            io.emit('playerDied', { id: p.id, by: proj.playerId });
          }
        }
      });
      io.emit('projectileShattered', { id: proj.id, x: proj.x, y: proj.y, type: 'bottle' });
      projectiles.splice(i, 1);
      continue;
    }

    for (const id in players) {
      const player = players[id];
      if (player.id !== proj.playerId && player.alive) {
        const dx = player.x - proj.x;
        const dy = player.y - proj.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 30) {
          const attacker = players[proj.playerId];
          const BEER_DAMAGE = attacker && attacker.activePowerUp === 'damage'
            ? Math.floor(MAX_HP * 0.2)
            : Math.floor(MAX_HP * 0.1);
          player.hp -= BEER_DAMAGE;
          if (attacker) {
            attacker.score += 5;
            attacker.damageDealt += BEER_DAMAGE;
          }
          io.emit('beerHit', {
            attackerId: proj.playerId,
            targetId: player.id,
            x: player.x,
            y: player.y
          });
          if (player.hp <= 0) {
            player.hp = 0;
            player.alive = false;
            player.respawnAt = now + RESPAWN_TIME;
            if (attacker) {
              attacker.kills += 1;
              attacker.score += 50;
            }
            io.emit('playerDied', { id: player.id, by: proj.playerId });
          }
          io.emit('projectileDestroyed', { id: proj.id });
          projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  if (now - lastStateBroadcast >= 1000 / STATE_BROADCAST_RATE) {
    const snapshot = Object.values(players).map(scrubPlayer);
    const leaderboard = Object.values(players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(p => ({ id: p.id, name: p.name, score: p.score, kills: p.kills, damage: p.damageDealt }));

    if (snapshot.length > 0) {
      io.emit('state', {
        players: snapshot,
        leaderboard,
        hill: { controller: hillController, contested: isContested, king: kingOfTheHill }
      });
    }
    lastStateBroadcast = now;
  }
}, 1000 / TICK_RATE);

function spawnPowerUp() {
  if (Object.keys(powerUps).length >= MAX_POWER_UPS) return;
  const availableSpawns = POWER_UP_SPAWN_LOCATIONS.filter(loc =>
    !Object.values(powerUps).some(p => p.x === loc.x && p.y === loc.y)
  );
  if (availableSpawns.length === 0) return;
  const location = availableSpawns[Math.floor(Math.random() * availableSpawns.length)];
  const type = Math.random() < 0.5 ? 'speed' : 'damage';
  const id = nextPowerUpId++;
  const powerUp = { id, x: location.x, y: location.y, type };
  powerUps[id] = powerUp;
  io.emit('powerUpSpawned', powerUp);
}

setInterval(spawnPowerUp, 5000);

function moveHill() {
  const padding = 150;
  hillZone = {
    x: Math.random() * (WORLD_SIZE.width - padding * 2) + padding,
    y: Math.random() * (WORLD_SIZE.height - padding * 2) + padding,
    radius: HILL_RADIUS
  };
  hillController = null;
  isContested = false;
  io.emit('hillMoved', hillZone);
}

moveHill();
setInterval(moveHill, HILL_MOVE_INTERVAL);

server.listen(PORT, () => {
  console.log(`BeerMugGame server running on port ${PORT}`);
});