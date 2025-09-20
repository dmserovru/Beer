const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = parseInt(process.env.PORT || '3003', 10);
const TICK_RATE = parseInt(process.env.TICK_RATE || '60', 10); // increased to 60 ticks per second for better responsiveness
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '100', 100);
const RESPAWN_TIME = parseInt(process.env.RESPAWN_TIME || '10000', 10); // ms
const MAX_HP = 100;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// serve client static files bundled in /client
app.use(express.static(__dirname + '/../client'));

let players = {}; // socketId -> player object

function createPlayer(id, name) {
  return {
    id,
    name: name || 'Player',
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50,
    vx: 0,
    vy: 0,
    hp: MAX_HP,
    score: 0,
    alive: true,
    respawnAt: null,
    lastInputSeq: 0
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
    alive: p.alive
  };
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
    socket.emit('joined', { id: socket.id, self: scrubPlayer(p) });
    io.emit('playerJoined', { player: scrubPlayer(p) });
    console.log('player joined:', p.name);
  });

  socket.on('input', (data) => {
    const p = players[socket.id];
    if (!p) return;
    // data: { seq, up, down, left, right, action, targetId, ax, ay }
    p.lastInputSeq = data.seq || p.lastInputSeq;

    // Optimized movement handling with immediate response
    const speed = 200; // px/s
    let vx = 0, vy = 0;
    if (data.left) vx -= 1;
    if (data.right) vx += 1;
    if (data.up) vy -= 1;
    if (data.down) vy += 1;
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
    } else {
      vx = 0; vy = 0;
    }
    p.vx = vx;
    p.vy = vy;

    // action handling: swing
    if (data.action === 'swing' && data.targetId) {
      handleHit(socket.id, data.targetId, data);
    }
  });

  // Handle beer shooting
  socket.on('shoot', (data) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    
    // Find targets hit by projectile
    const projectileRange = 80; // range of beer projectile
    const projectileSpeed = 300;
    const projectileLifetime = 1000; // ms
    
    // Check collision with other players
    Object.keys(players).forEach(targetId => {
      if (targetId === socket.id) return;
      const target = players[targetId];
      if (!target || !target.alive) return;
      
      // Calculate if projectile hits target
      const dx = target.x - data.x;
      const dy = target.y - data.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist < projectileRange) {
        handleBeerHit(socket.id, targetId, data);
      }
    });
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

  // Validate approximate distance between reported attacker pos (ax,ay) and server target pos
  const ax = (typeof data.ax === 'number') ? data.ax : attacker.x;
  const ay = (typeof data.ay === 'number') ? data.ay : attacker.y;
  const dx = ax - target.x;
  const dy = ay - target.y;
  const dist = Math.hypot(dx, dy);
  const MAX_HIT_RANGE = 120;
  if (dist > MAX_HIT_RANGE) return; // likely invalid / out of range

  const DAMAGE = 34;
  target.hp -= DAMAGE;
  attacker.score += 10;

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.respawnAt = Date.now() + RESPAWN_TIME;
    io.emit('playerDied', { id: target.id, by: attacker.id });
  }
}

function handleBeerHit(attackerId, targetId, data) {
  const attacker = players[attackerId];
  const target = players[targetId];
  if (!attacker || !target) return;
  if (!attacker.alive || !target.alive) return;

  // Beer projectile damage - 10% of max HP
  const BEER_DAMAGE = Math.floor(MAX_HP * 0.1); // 10% damage
  target.hp -= BEER_DAMAGE;
  attacker.score += 5; // Less score for beer hits

  // Emit hit effect to all clients
  io.emit('beerHit', { 
    attackerId, 
    targetId, 
    x: target.x, 
    y: target.y 
  });

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    target.respawnAt = Date.now() + RESPAWN_TIME;
    io.emit('playerDied', { id: target.id, by: attacker.id });
  }
}

// Optimized server loop with delta time and selective updates
let lastUpdate = Date.now();
let lastStateBroadcast = 0;
const STATE_BROADCAST_RATE = 20; // broadcast state 20 times per second

setInterval(() => {
  const now = Date.now();
  const dt = (now - lastUpdate) / 1000; // delta time in seconds
  lastUpdate = now;

  // Update positions with delta time for smooth movement
  for (const id in players) {
    const p = players[id];
    if (p.alive) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // simple bounds
      p.x = Math.max(20, Math.min(780, p.x));
      p.y = Math.max(20, Math.min(580, p.y));
    } else {
      if (p.respawnAt && now >= p.respawnAt) {
        p.x = Math.floor(Math.random() * 700) + 50;
        p.y = Math.floor(Math.random() * 500) + 50;
        p.hp = MAX_HP;
        p.alive = true;
        p.respawnAt = null;
        io.to(p.id).emit('respawned');
      }
    }
  }

  // Broadcast state less frequently to reduce network traffic
  if (now - lastStateBroadcast >= 1000 / STATE_BROADCAST_RATE) {
    const snapshot = Object.values(players).map(scrubPlayer);
    const leaderboard = Object.values(players)
      .sort((a,b) => b.score - a.score)
      .slice(0,10)
      .map(p => ({ id: p.id, name: p.name, score: p.score }));

    // Only broadcast if there are players
    if (snapshot.length > 0) {
      io.emit('state', { players: snapshot, leaderboard });
    }
    lastStateBroadcast = now;
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`BeerMugGame server running on port ${PORT}`);
});
