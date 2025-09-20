/* Phaser 3 + Socket.IO client for BeerMugGame
   Enhanced with animations, collisions, and beer shooting
*/

const socket = io();
console.log("Socket created:", socket);
let game;
let selfId = null;
let players = {}; // id -> { sprite, nameText, hpBar, data, lastDirection }
let cursors;
let swingKey;
let shootKey;
let seq = 0;
let projectiles = []; // beer projectiles
let lastShootTime = 0;
const SHOOT_COOLDOWN = 500; // ms
let lastInputTime = 0;
const INPUT_SEND_RATE = 30; // send input 30 times per second
let pendingInputs = []; // queue for input reconciliation

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  backgroundColor: '#091021',
  physics: {
    default: 'arcade',
    arcade: { 
      debug: false,
      gravity: { y: 0 }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

function preload() {
  console.log("Loading textures...");
  // No need to load textures here - we'll create them programmatically in create()
  console.log("Textures will be created programmatically!");
}

function create() {
  console.log("Game scene created!");
  const scene = this;
  
  // Create beer mug texture programmatically
  createBeerMugTexture(scene);
  createBeerProjectileTexture(scene);
  
  cursors = scene.input.keyboard.createCursorKeys();
  swingKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  shootKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  console.log("Keys configured:", { swingKey, shootKey });

  const joinBtn = document.getElementById('joinBtn');
  const nameInput = document.getElementById('name');
  
  console.log("Join button:", joinBtn);
  console.log("Name input:", nameInput);
  
  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const name = nameInput ? nameInput.value || 'Player' : 'Player';
      console.log("Join button clicked! Name:", name);
      socket.emit('join', { name });
    });
    console.log("Join button event listener added");
  } else {
    console.error("Join button not found!");
  }

  socket.on('connect', () => {
    console.log("Connected to server!");
  });
  
  socket.on('disconnect', () => {
    console.log("Disconnected from server!");
  });
  
  socket.on('joined', (data) => {
    console.log("Joined game with ID:", data.id);
    selfId = data.id;
    document.getElementById('join').style.display = 'none';
    
    // Create self player immediately
    if (data.self) {
      console.log("Creating self player:", data.self);
      addOrUpdateRemotePlayer(data.self, scene);
    }
  });

  socket.on('joinError', (err) => {
    console.error("Join error:", err);
    alert(err.message || 'Join error');
  });
  
  socket.on('connect_error', (error) => {
    console.error("Connection error:", error);
  });

  socket.on('playerJoined', ({ player }) => {
    addOrUpdateRemotePlayer(player, scene);
  });

  socket.on('playerLeft', ({ id }) => {
    removePlayer(id);
  });

  socket.on('playerDied', ({ id, by }) => {
    const p = players[id];
    if (p) {
      // Death animation - кружка разбивается
      scene.tweens.add({
        targets: p.sprite,
        alpha: 0.2,
        scaleX: 0.5,
        scaleY: 0.5,
        angle: 180,
        duration: 300,
        ease: 'Power2'
      });
      setTimeout(() => { 
        if (p) {
          p.sprite.setAlpha(1);
          p.sprite.setScale(1);
          p.sprite.setAngle(0);
        }
      }, 300);
    }
  });

  socket.on('respawned', () => {
    // Respawn animation - кружка появляется с эффектом
    const me = players[selfId];
    if (me) {
      scene.tweens.add({
        targets: me.sprite,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 200,
        yoyo: true,
        ease: 'Power2'
      });
    }
  });

  socket.on('beerHit', ({ attackerId, targetId, x, y }) => {
    // Create beer splash effect
    const splash = scene.add.circle(x, y, 20, 0xFFD700, 0.8);
    scene.tweens.add({
      targets: splash,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => splash.destroy()
    });
    
    // Shake effect for hit player
    const target = players[targetId];
    if (target) {
      scene.tweens.add({
        targets: target.sprite,
        x: target.sprite.x + 5,
        duration: 50,
        yoyo: true,
        repeat: 3,
        ease: 'Power2'
      });
    }
  });

  socket.on('state', ({ players: statePlayers, leaderboard }) => {
    console.log("Received state update:", statePlayers.length, "players");
    statePlayers.forEach(p => {
      addOrUpdateRemotePlayer(p, scene);
    });
    // remove ones not in state
    const ids = statePlayers.map(p => p.id);
    Object.keys(players).forEach(id => {
      if (!ids.includes(id)) removePlayer(id);
    });
    renderLeaderboard(leaderboard);
  });
}

function addOrUpdateRemotePlayer(p, scene) {
  if (!players[p.id]) {
    console.log("Creating new player:", p.name, "at", p.x, p.y);
    // Create beer mug sprite with physics
    const sprite = scene.physics.add.sprite(p.x, p.y, 'beer');
    sprite.setCollideWorldBounds(true);
    sprite.setBounce(0.3);
    sprite.setDrag(100);
    
    const nameText = scene.add.text(p.x - 24, p.y - 44, p.name, { 
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setDepth(2);
    
    const hpBarBg = scene.add.rectangle(p.x - 25, p.y - 30, 50, 6, 0x333333).setDepth(2);
    const hpBar = scene.add.rectangle(p.x - 25, p.y - 30, 50, 6, 0x00ff00).setDepth(3);
    
    players[p.id] = { sprite, nameText, hpBar, hpBarBg, data: p, lastDirection: { x: 0, y: 0 } };
    console.log("Player created successfully:", p.name);
    
    // Add collision between players
    Object.keys(players).forEach(id => {
      if (id !== p.id && players[id]) {
        scene.physics.add.collider(sprite, players[id].sprite, (sprite1, sprite2) => {
          handlePlayerCollision(sprite1, sprite2);
        });
      }
    });
  } else {
    players[p.id].data = p;
  }
}

function handlePlayerCollision(sprite1, sprite2) {
  // Optimized collision with reduced force for better performance
  const angle = Phaser.Math.Angle.Between(sprite1.x, sprite1.y, sprite2.x, sprite2.y);
  const force = 30; // reduced force for smoother gameplay
  
  sprite1.setVelocity(
    Math.cos(angle) * force,
    Math.sin(angle) * force
  );
  sprite2.setVelocity(
    Math.cos(angle + Math.PI) * force,
    Math.sin(angle + Math.PI) * force
  );
  
  // Reduced rotation effect for better performance
  sprite1.setAngularVelocity(100);
  sprite2.setAngularVelocity(-100);
  
  // Stop rotation after a shorter time
  setTimeout(() => {
    if (sprite1 && sprite1.active) sprite1.setAngularVelocity(0);
    if (sprite2 && sprite2.active) sprite2.setAngularVelocity(0);
  }, 300);
}

function removePlayer(id) {
  const p = players[id];
  if (!p) return;
  p.sprite.destroy();
  p.nameText.destroy();
  p.hpBar.destroy();
  p.hpBarBg.destroy();
  delete players[id];
}

function renderLeaderboard(top) {
  const el = document.getElementById('leaderboard');
  el.innerHTML = '<h3 style="margin:0 0 8px 0;">Leaderboard</h3>' + top.map(x => `<div>${escapeHtml(x.name)}: ${x.score}</div>`).join('');
}

function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function createBeerMugTexture(scene) {
  // Create a graphics object to draw the beer mug
  const graphics = scene.add.graphics();
  
  // Draw beer mug
  graphics.fillStyle(0x8B4513); // Brown color
  graphics.fillEllipse(22, 30, 36, 24); // Base
  graphics.fillEllipse(22, 18, 32, 16); // Top
  
  // Draw handle
  graphics.lineStyle(3, 0x654321);
  graphics.beginPath();
  graphics.arc(4, 22, 8, 0, Math.PI);
  graphics.strokePath();
  
  // Draw beer
  graphics.fillStyle(0xFFD700); // Gold
  graphics.fillEllipse(22, 20, 28, 12);
  graphics.fillStyle(0xFFA500); // Orange
  graphics.fillEllipse(22, 18, 24, 8);
  
  // Draw foam
  graphics.fillStyle(0xFFFFFF); // White
  graphics.fillEllipse(22, 14, 20, 6);
  graphics.fillEllipse(18, 13, 4, 3);
  graphics.fillEllipse(26, 13, 4, 3);
  graphics.fillEllipse(22, 12, 3, 2);
  
  // Generate texture from graphics
  graphics.generateTexture('beer', 44, 44);
  graphics.destroy();
}

function createBeerProjectileTexture(scene) {
  // Create a graphics object to draw the beer projectile
  const graphics = scene.add.graphics();
  
  // Draw beer drop
  graphics.fillStyle(0xFFD700); // Gold
  graphics.fillEllipse(8, 10, 12, 8);
  graphics.fillStyle(0xFF8C00); // Orange
  graphics.fillEllipse(8, 8, 8, 6);
  graphics.fillStyle(0xFFFFFF); // White
  graphics.fillEllipse(8, 6, 4, 3);
  
  // Generate texture from graphics
  graphics.generateTexture('beerProjectile', 16, 16);
  graphics.destroy();
}

function createBeerProjectile(scene, x, y, vx, vy) {
  try {
    const projectile = scene.physics.add.sprite(x, y, 'beerProjectile');
    projectile.setVelocity(vx, vy);
    projectile.setCollideWorldBounds(true);
    projectile.setBounce(0.5);
    projectile.setDrag(50);
    
    // Add rotation animation - beer drop rotates
    scene.tweens.add({
      targets: projectile,
      angle: 360,
      duration: 1000,
      repeat: -1,
      ease: 'Linear'
    });
    
    // Remove projectile after 3 seconds
    scene.time.delayedCall(3000, () => {
      if (projectile && projectile.active) {
        projectile.destroy();
      }
    });
    
    return projectile;
  } catch (error) {
    console.error("Error creating projectile:", error);
    return null;
  }
}

function update(time, delta) {
  const scene = this;
  if (!selfId) return;
  
  // Debug: log every 60 frames
  if (Math.floor(time / 1000) !== Math.floor((time - delta) / 1000)) {
    console.log("Game update - selfId:", selfId, "players:", Object.keys(players).length);
  }

  // Optimized input handling with throttling
  const input = { 
    seq: ++seq,
    left: cursors.left.isDown,
    right: cursors.right.isDown,
    up: cursors.up.isDown,
    down: cursors.down.isDown,
    action: swingKey.isDown ? 'swing' : null
  };
  
  // Debug: log key presses
  if (shootKey.isDown) {
    console.log("Space key is DOWN!");
  }
  
  // Shooting with space key - beer shooting
  const canShoot = time - lastShootTime > SHOOT_COOLDOWN;
  if (shootKey.isDown && canShoot) {
    console.log("SHOOTING! Space key pressed");
    const me = players[selfId];
    if (me) {
      // Get movement direction for shooting
      let shootVx = 0, shootVy = 0;
      if (input.left) shootVx -= 1;
      if (input.right) shootVx += 1;
      if (input.up) shootVy -= 1;
      if (input.down) shootVy += 1;
      
      // If not moving, use last direction
      if (shootVx === 0 && shootVy === 0) {
        shootVx = me.lastDirection.x;
        shootVy = me.lastDirection.y;
      }
      
      // If still no direction, shoot right
      if (shootVx === 0 && shootVy === 0) {
        shootVx = 1;
      }
      
      // Normalize and set speed
      const len = Math.hypot(shootVx, shootVy);
      if (len > 0) {
        shootVx = (shootVx / len) * 300;
        shootVy = (shootVy / len) * 300;
      }
      
      console.log("Shoot direction:", shootVx, shootVy);
      
      // Create projectile
      console.log("Creating projectile at", me.sprite.x, me.sprite.y, "with velocity", shootVx, shootVy);
      const projectile = createBeerProjectile(scene, me.sprite.x, me.sprite.y, shootVx, shootVy);
      if (!projectile) {
        console.error("Failed to create projectile!");
      }
      lastShootTime = time;
      
      // Send shoot event to server
      console.log("Sending shoot event to server");
      socket.emit('shoot', { 
        x: me.sprite.x, 
        y: me.sprite.y, 
        vx: shootVx, 
        vy: shootVy 
      });
    }
  }

  // Optimized local prediction with immediate response
  const speed = 200;
  let vx = 0, vy = 0;
  if (input.left) vx -= 1; if (input.right) vx += 1;
  if (input.up) vy -= 1; if (input.down) vy += 1;
  const len = Math.hypot(vx, vy);
  if (len > 0) { 
    vx = vx / len * speed; 
    vy = vy / len * speed; 
  } else { 
    vx = 0; 
    vy = 0; 
  }

  const me = players[selfId];
  if (me) {
    // Store last direction for shooting
    if (vx !== 0 || vy !== 0) {
      me.lastDirection.x = vx / speed;
      me.lastDirection.y = vy / speed;
    }
    
    // Immediate local movement for instant response
    me.sprite.x += vx * (delta / 1000);
    me.sprite.y += vy * (delta / 1000);
    
    // Keep within bounds
    me.sprite.x = Math.max(20, Math.min(780, me.sprite.x));
    me.sprite.y = Math.max(20, Math.min(580, me.sprite.y));
    
    // Update UI elements
    me.nameText.x = me.sprite.x - 24;
    me.nameText.y = me.sprite.y - 44;
    me.hpBarBg.x = me.sprite.x - 25;
    me.hpBarBg.y = me.sprite.y - 30;
    me.hpBar.x = me.sprite.x - 25;
    me.hpBar.y = me.sprite.y - 30;
    
  // Add rotation animation based on movement - mug tilts when moving
  if (vx !== 0 || vy !== 0) {
    const angle = Math.atan2(vy, vx) * (180 / Math.PI);
    scene.tweens.add({
      targets: me.sprite,
      angle: angle * 0.3, // slight tilt
      duration: 200,
      ease: 'Power2'
    });
  }
  }

  // Throttled input sending to reduce network traffic
  if (time - lastInputTime >= 1000 / INPUT_SEND_RATE) {
    // if swinging, find nearest target and send input with targetId and attacker pos
    if (input.action) {
      const range = 100;
      let targetId = null; let best = 1e9;
      if (me) {
        Object.keys(players).forEach(id => {
          if (id === selfId) return;
          const p = players[id];
          const dx = p.sprite.x - me.sprite.x;
          const dy = p.sprite.y - me.sprite.y;
          const d = Math.hypot(dx, dy);
          if (d < range && d < best) { best = d; targetId = id; }
        });
      }
      if (targetId) {
        socket.emit('input', { seq, left: input.left, right: input.right, up: input.up, down: input.down, action: 'swing', targetId, ax: me ? me.sprite.x : 0, ay: me ? me.sprite.y : 0 });
      } else {
        socket.emit('input', { seq, left: input.left, right: input.right, up: input.up, down: input.down });
      }
    } else {
      socket.emit('input', { seq, left: input.left, right: input.right, up: input.up, down: input.down });
    }
    lastInputTime = time;
  }

  // Optimized reconciliation with better interpolation
  Object.keys(players).forEach(id => {
    const p = players[id];
    if (!p.data) return;
    
    // Skip interpolation for self to avoid input lag
    if (id === selfId) {
      // Only update UI for self
      p.nameText.x = p.sprite.x - 24;
      p.nameText.y = p.sprite.y - 44;
      p.hpBarBg.x = p.sprite.x - 25;
      p.hpBarBg.y = p.sprite.y - 30;
      p.hpBar.x = p.sprite.x - 25;
      p.hpBar.y = p.sprite.y - 30;
    } else {
      // Smooth interpolation for other players
      const lerpFactor = Math.min(0.3, delta / 16.67); // adaptive lerp based on framerate
      p.sprite.x = Phaser.Math.Linear(p.sprite.x, p.data.x, lerpFactor);
      p.sprite.y = Phaser.Math.Linear(p.sprite.y, p.data.y, lerpFactor);
      
      // Update UI elements
      p.nameText.x = p.sprite.x - 24;
      p.nameText.y = p.sprite.y - 44;
      p.hpBarBg.x = p.sprite.x - 25;
      p.hpBarBg.y = p.sprite.y - 30;
      p.hpBar.x = p.sprite.x - 25;
      p.hpBar.y = p.sprite.y - 30;
    }
    
    // Fixed health bar calculation - исправленная полоса жизней
    const hpPercentage = Math.max(0, p.data.hp / 100);
    const hpWidth = hpPercentage * 50;
    p.hpBar.width = hpWidth;

    // Health bar color based on HP
    if (p.data.hp > 60) p.hpBar.fillColor = 0x00ff00;
    else if (p.data.hp > 30) p.hpBar.fillColor = 0xffa500;
    else p.hpBar.fillColor = 0xff0000;

    // Alpha based on alive status
    if (!p.data.alive) p.sprite.setAlpha(0.4); 
    else p.sprite.setAlpha(1);
  });
}

window.addEventListener('load', () => { 
  console.log("Window loaded, creating Phaser game...");
  game = new Phaser.Game(config); 
  console.log("Phaser game created:", game);
});