const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT || '3003', 10);
const TICK_RATE = parseInt(process.env.TICK_RATE || '60', 10);
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '100', 100);
const RESPAWN_TIME = parseInt(process.env.RESPAWN_TIME || '10000', 10);
const MAX_HP = 100;
// Меньший размер карты для статичной камеры
const WORLD_SIZE = { width: 800, height: 600 };
const POWER_UP_DURATION = 10000;
const POWER_UP_RESPAWN_TIME = 20000;
const MAX_POWER_UPS = 5;
const SWING_COOLDOWN = 2000;

const HILL_RADIUS = 80;
const HILL_SCORE_RATE = 25;
const HILL_MOVE_INTERVAL = 45000;

// Улучшенная генерация позиций для избежания столкновений
function generateSafePositions(count, width, height, existingObjects = []) {
  const positions = [];
  const minDistance = 70;
  let attempts = 0;
  const maxAttempts = count * 10;

  while (positions.length < count && attempts < maxAttempts) {
    const x = 80 + Math.random() * (width - 160);
    const y = 80 + Math.random() * (height - 160);
    
    let validPosition = true;
    
    for (const existing of [...existingObjects, ...positions]) {
      const dx = x - existing.x;
      const dy = y - existing.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        validPosition = false;
        break;
      }
    }
    
    if (validPosition) {
      positions.push({ x: Math.floor(x), y: Math.floor(y) });
    }
    
    attempts++;
  }
  
  return positions;
}

// Генерируем безопасные позиции для объектов
const walls = generateSafePositions(8, WORLD_SIZE.width, WORLD_SIZE.height).map(pos => ({
  x: pos.x,
  y: pos.y,
  width: 25 + Math.random() * 35,
  height: 25 + Math.random() * 35,
  angle: Math.random() * 90
}));

const bushes = generateSafePositions(6, WORLD_SIZE.width, WORLD_SIZE.height, walls);
const trees = generateSafePositions(4, WORLD_SIZE.width, WORLD_SIZE.height, [...walls, ...bushes]);

const POWER_UP_SPAWN_LOCATIONS = generateSafePositions(8, WORLD_SIZE.width, WORLD_SIZE.height, [...walls, ...bushes, ...trees]);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
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
  let spawnX, spawnY;
  let attempts = 0;
  const maxAttempts = 50;
  
  do {
    spawnX = 50 + Math.random() * (WORLD_SIZE.width - 100);
    spawnY = 50 + Math.random() * (WORLD_SIZE.height - 100);
    attempts++;
  } while (checkWallCollision(spawnX, spawnY, 25) && attempts < maxAttempts);
  
  if (attempts >= maxAttempts) {
    spawnX = WORLD_SIZE.width / 2;
    spawnY = WORLD_SIZE.height / 2;
  }

  return {
    id,
    name: name || 'Player',
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    hp: MAX_HP,
    score: 0,
    kills: 0,
    damageDealt: 0,
    alive: true,
    respawnAt: null,
    lastInputSeq: 0,
    lastDirection: { x: 1, y: 0 },
    activePowerUp: null,
    powerUpTimer: 0,
    lastSwingTime: 0,
    hillTime: 0,
    lastShootTime: 0
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
    x: Math.round(p.x * 100) / 100,
    y: Math.round(p.y * 100) / 100,
    hp: Math.round(p.hp),
    score: Math.round(p.score),
    kills: p.kills,
    damageDealt: Math.round(p.damageDealt),
    alive: p.alive,
    lastDirection: p.lastDirection,
    activePowerUp: p.activePowerUp,
    hillTime: Math.round(p.hillTime)
  };
}

function checkWallCollision(x, y, radius = 22) {
  if (x - radius < 0 || x + radius > WORLD_SIZE.width || 
      y - radius < 0 || y + radius > WORLD_SIZE.height) {
    return true;
  }
  
  for (const wall of walls) {
    const cos = Math.cos(wall.angle * Math.PI / 180);
    const sin = Math.sin(wall.angle * Math.PI / 180);
    const localX = (x - wall.x) * cos + (y - wall.y) * sin;
    const localY = -(x - wall.x) * sin + (y - wall.y) * cos;
    
    if (Math.abs(localX) < wall.width / 2 + radius && 
        Math.abs(localY) < wall.height / 2 + radius) {
      return true;
    }
  }
  return false;
}

function checkProjectileWallCollision(x, y, radius = 8) {
  if (x - radius < 0 || x + radius > WORLD_SIZE.width || 
      y - radius < 0 || y + radius > WORLD_SIZE.height) {
    return true;
  }
  
  for (const wall of walls) {
    const cos = Math.cos(wall.angle * Math.PI / 180);
    const sin = Math.sin(wall.angle * Math.PI / 180);
    const localX = (x - wall.x) * cos + (y - wall.y) * sin;
    const localY = -(x - wall.x) * sin + (y - wall.y) * cos;
    
    if (Math.abs(localX) < wall.width / 2 + radius && 
        Math.abs(localY) < wall.height / 2 + radius) {
      return true;
    }
  }
  return false;
}

function findSafeRespawnPosition() {
  let x, y;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    x = 50 + Math.random() * (WORLD_SIZE.width - 100);
    y = 50 + Math.random() * (WORLD_SIZE.height - 100);
    attempts++;
  } while (checkWallCollision(x, y, 25) && attempts < maxAttempts);
  
  if (attempts >= maxAttempts) {
    const safeSpots = [
      { x: WORLD_SIZE.width * 0.2, y: WORLD_SIZE.height * 0.2 },
      { x: WORLD_SIZE.width * 0.8, y: WORLD_SIZE.height * 0.2 },
      { x: WORLD_SIZE.width * 0.2, y: WORLD_SIZE.height * 0.8 },
      { x: WORLD_SIZE.width * 0.8, y: WORLD_SIZE.height * 0.8 },
      { x: WORLD_SIZE.width * 0.5, y: WORLD_SIZE.height * 0.5 }
    ];
    
    const spot = safeSpots[Math.floor(Math.random() * safeSpots.length)];
    x = spot.x;
    y = spot.y;
  }
  
  return { x, y };
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', ({ name }) => {
    if (Object.keys(players).length >= MAX_PLAYERS) {
      socket.emit('joinError', { message: 'Сервер переполнен' });
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
    
    socket.broadcast.emit('playerJoined', { player: scrubPlayer(p) });
    console.log('player joined:', p.name, 'at', p.x, p.y);
  });

  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;

    if (typeof data.seq !== 'number') return;
    
    p.lastInputSeq = data.seq;

    const speed = p.activePowerUp === 'speed' ? 300 : 200;
    let vx = 0, vy = 0;
    
    if (data.left === true) vx -= 1;
    if (data.right === true) vx += 1;
    if (data.up === true) vy -= 1;
    if (data.down === true) vy += 1;

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
        let shootVx = p.lastDirection.x * speed;
        let shootVy = p.lastDirection.y * speed;

        if (shootVx === 0 && shootVy === 0) {
          shootVx = speed;
        }

        const bottle = {
          id: Math.random().toString(36).substring(7),
          playerId: socket.id,
          x: p.x,
          y: p.y,
          vx: shootVx,
          vy: shootVy,
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

    const now = Date.now();
    const SHOOT_COOLDOWN = 300;
    
    if (now - p.lastShootTime < SHOOT_COOLDOWN) return;
    p.lastShootTime = now;

    if (typeof data.x !== 'number' || typeof data.y !== 'number' ||
        typeof data.vx !== 'number' || typeof data.vy !== 'number') {
      return;
    }

    const maxSpeed = 400;
    const speed = Math.hypot(data.vx, data.vy);
    if (speed > maxSpeed) {
      data.vx = (data.vx / speed) * maxSpeed;
      data.vy = (data.vy / speed) * maxSpeed;
    }

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
      socket.broadcast.emit('playerLeft', { id: socket.id });
    }
  });
});

let lastUpdate = Date.now();
let lastStateBroadcast = 0;
const STATE_BROADCAST_RATE = 30;
const PROJECTILE_LIFETIME = 5000;

setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - lastUpdate) / 1000, 1/30);
  lastUpdate = now;

  for (const id in players) {
    const p = players[id];
    if (p.alive) {
      const vel_x = p.vx;
      const vel_y = p.vy;

      let next_x = p.x + vel_x * dt;
      next_x = Math.max(25, Math.min(WORLD_SIZE.width - 25, next_x));
      
      if (!checkWallCollision(next_x, p.y, 22)) {
        p.x = next_x;
      } else {
        p.vx = 0;
      }

      let next_y = p.y + vel_y * dt;
      next_y = Math.max(25, Math.min(WORLD_SIZE.height - 25, next_y));
      
      if (!checkWallCollision(p.x, next_y, 22)) {
        p.y = next_y;
      } else {
        p.vy = 0;
      }

      for (const powerUpId in powerUps) {
        const powerUp = powerUps[powerUpId];
        const dx = p.x - powerUp.x;
        const dy = p.y - powerUp.y;
        if (Math.hypot(dx, dy) < 35) {
          p.activePowerUp = powerUp.type;
          p.powerUpTimer = Date.now() + POWER_UP_DURATION;
          delete powerUps[powerUpId];
          io.emit('powerUpCollected', { powerUpId: powerUpId, playerId: p.id });
          setTimeout(() => spawnPowerUp(), POWER_UP_RESPAWN_TIME);
          break;
        }
      }

      if (p.powerUpTimer && now > p.powerUpTimer) {
        p.activePowerUp = null;
        p.powerUpTimer = 0;
      }

      const playersInHill = Object.values(players).filter(player => 
        player.alive && Math.hypot(player.x - hillZone.x, player.y - hillZone.y) < HILL_RADIUS
      );
      
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
        const spawnPos = findSafeRespawnPosition();
        p.x = spawnPos.x;
        p.y = spawnPos.y;
        p.hp = MAX_HP;
        p.alive = true;
        p.respawnAt = null;
        p.vx = 0;
        p.vy = 0;
        io.to(p.id).emit('respawned');
      }
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    const lifetime = proj.type === 'bottle' ? 2000 : PROJECTILE_LIFETIME;
    let shouldDestroy = false;

    if (checkProjectileWallCollision(proj.x, proj.y)) {
      shouldDestroy = true;
    }

    if (now - proj.createdAt > lifetime) {
      shouldDestroy = true;
    }

    if (shouldDestroy) {
      if (proj.type === 'bottle') {
        const BOTTLE_AOE_DAMAGE = 25;
        const BOTTLE_AOE_RADIUS = 60;
        Object.values(players).forEach(p => {
          if (p.alive && p.id !== proj.playerId && Math.hypot(p.x - proj.x, p.y - proj.y) < BOTTLE_AOE_RADIUS) {
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
              if (attacker) {
                attacker.kills += 1;
                attacker.score += 50;
              }
              io.emit('playerDied', { id: p.id, by: proj.playerId });
            }
          }
        });
        io.emit('projectileShattered', { id: proj.id, x: proj.x, y: proj.y, type: 'bottle' });
      } else {
        io.emit('projectileDestroyed', { id: proj.id });
      }
      projectiles.splice(i, 1);
      continue;
    }

    let hit = false;
    for (const playerId in players) {
      const player = players[playerId];
      if (player.id !== proj.playerId && player.alive) {
        const dx = player.x - proj.x;
        const dy = player.y - proj.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 25) {
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
          hit = true;
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
      .map(p => ({ 
        id: p.id, 
        name: p.name, 
        score: Math.round(p.score), 
        kills: p.kills, 
        damage: Math.round(p.damageDealt) 
      }));

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
    !Object.values(powerUps).some(p => Math.hypot(p.x - loc.x, p.y - loc.y) < 50)
  );
  
  if (availableSpawns.length === 0) return;
  
  const location = availableSpawns[Math.floor(Math.random() * availableSpawns.length)];
  const type = Math.random() < 0.5 ? 'speed' : 'damage';
  const id = nextPowerUpId++;
  
  const powerUp = { id, x: location.x, y: location.y, type };
  powerUps[id] = powerUp;
  io.emit('powerUpSpawned', powerUp);
}

setInterval(spawnPowerUp, 8000);

function moveHill() {
  const padding = 120;
  hillZone = {
    x: Math.random() * (WORLD_SIZE.width - padding * 2) + padding,
    y: Math.random() * (WORLD_SIZE.height - padding * 2) + padding,
    radius: HILL_RADIUS
  };
  hillController = null;
  isContested = false;
  io.emit('hillMoved', hillZone);
  console.log('Hill moved to', hillZone.x, hillZone.y);
}

moveHill();
setInterval(moveHill, HILL_MOVE_INTERVAL);

setTimeout(() => {
  for (let i = 0; i < 3; i++) {
    setTimeout(spawnPowerUp, i * 1000);
  }
}, 2000);

server.listen(PORT, () => {
  console.log(`BeerMugGame server running on port ${PORT}`);
  console.log(`World size: ${WORLD_SIZE.width}x${WORLD_SIZE.height}`);
  console.log(`Tick rate: ${TICK_RATE}/sec`);
  console.log(`Max players: ${MAX_PLAYERS}`);
});