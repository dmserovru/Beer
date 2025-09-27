const socket = io();
console.log("Socket created:", socket);
let game;
let selfId = null;
let players = {};
let cursors;
let swingKey;
let shootKey;
let seq = 0;
let projectiles = {};
let lastShootTime = 0;
const SHOOT_COOLDOWN = 500;
let lastInputTime = 0;
const INPUT_SEND_RATE = 30;
let pendingInputs = [];
let walls = [];
let wallSprites = [];
let bushes = [];
let bushSprites = [];
let trees = [];
let treeSprites = [];
let powerUpSprites = {};

let hillZoneSprite;
let kingOfTheHillUI;

// Мобильные элементы управления
let joystickOrigin = { x: 0, y: 0 };
let joystickActive = false;
let mobileInput = { left: false, right: false, up: false, down: false };
let isMobileDevice = false;

// Оптимизация интерполяции
const LERP_FACTOR = 0.2;
const POSITION_THRESHOLD = 30;

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#2a2a2a',
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
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

function preload() {
  console.log("Loading textures...");
  this.load.audio('shoot', 'assets/shoot.mp3');
  this.load.audio('hit', 'assets/hit.mp3');
  this.load.audio('death', 'assets/death.mp3');
  this.load.audio('shatter', 'assets/shatter.mp3');
}

function create() {
  console.log("Game scene created!");
  const scene = this;

  createBeerMugTexture(scene);
  createBeerProjectileTexture(scene);
  createWallTexture(scene);
  createBushTexture(scene);
  createTreeTexture(scene);
  createPowerUpTextures(scene);
  createBottleTexture(scene);

  isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                   window.innerWidth < 768;

  if (isMobileDevice) {
    console.log("Mobile device detected");
    document.getElementById('mobile-controls').style.display = 'flex';
    setupMobileControls(scene);
  } else {
    console.log("Desktop device detected");
    cursors = scene.input.keyboard.createCursorKeys();
    swingKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    shootKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  const joinBtn = document.getElementById('joinBtn');
  const nameInput = document.getElementById('name');

  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const name = nameInput ? nameInput.value || 'Player' : 'Player';
      console.log("Join button clicked! Name:", name);
      socket.emit('join', { name });
    });
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

    if (data.worldSize) {
      scene.physics.world.setBounds(0, 0, data.worldSize.width, data.worldSize.height);

      const gridGraphics = scene.add.graphics();
      gridGraphics.fillStyle(0x222222, 1);
      gridGraphics.fillRect(0, 0, data.worldSize.width, data.worldSize.height);
      gridGraphics.lineStyle(1, 0x333333, 1);
      for (let i = 0; i < data.worldSize.width; i += 50) {
        gridGraphics.moveTo(i, 0);
        gridGraphics.lineTo(i, data.worldSize.height);
      }
      for (let i = 0; i < data.worldSize.height; i += 50) {
        gridGraphics.moveTo(0, i);
        gridGraphics.lineTo(data.worldSize.width, i);
      }
      gridGraphics.strokePath();
      gridGraphics.setDepth(-1);
    }

    createWalls(scene, data.walls);
    createBushes(scene, data.bushes || []);
    createTrees(scene, data.trees || []);

    if (data.powerUps) {
      data.powerUps.forEach(p => createPowerUp(scene, p));
    }
    if (data.hillZone) {
      createOrUpdateHillZone(scene, data.hillZone);
    }

    if (data.self) {
      console.log("Creating self player:", data.self);
      addOrUpdatePlayer(data.self, scene, true);
    }
  });

  socket.on('joinError', (err) => {
    console.error("Join error:", err);
    alert(err.message || 'Join error');
  });

  socket.on('playerJoined', ({ player }) => {
    console.log("Player joined:", player.name);
    addOrUpdatePlayer(player, scene, false);
  });

  socket.on('playerLeft', ({ id }) => {
    console.log("Player left:", id);
    removePlayer(id);
  });

  socket.on('playerDied', ({ id, by }) => {
    const p = players[id];
    if (p) {
      scene.sound.play('death');
      scene.tweens.add({
        targets: p.sprite,
        alpha: 0.4,
        angle: 180,
        duration: 300,
        ease: 'Power2'
      });
    }
  });

  socket.on('respawned', () => {
    const me = players[selfId];
    if (me) {
      scene.tweens.add({
        targets: me.sprite,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 200,
        yoyo: true,
        ease: 'Power2'
      });
    }
  });

  socket.on('beerHit', ({ attackerId, targetId, x, y }) => {
    scene.sound.play('hit');
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

  socket.on('powerUpSpawned', (powerUp) => {
    createPowerUp(scene, powerUp);
  });

  socket.on('powerUpCollected', ({ powerUpId, playerId }) => {
    if (powerUpSprites[powerUpId]) {
      powerUpSprites[powerUpId].destroy();
      delete powerUpSprites[powerUpId];
    }
  });

  socket.on('projectileCreated', (projectile) => {
    if (projectile.playerId === selfId && projectile.localId && projectiles[projectile.localId]) {
      const localProj = projectiles[projectile.localId];
      delete projectiles[projectile.localId];
      localProj.id = projectile.id;
      projectiles[projectile.id] = localProj;
      return;
    }

    const projSprite = createBeerProjectile(scene, projectile);
    if (projSprite) {
      wallSprites.forEach(wall => {
        scene.physics.add.collider(projSprite, wall, (projectileSprite, wallSprite) => {
          const idToDestroy = projectileSprite.id;
          if (projectiles[idToDestroy]) {
            projectiles[idToDestroy].destroy();
            delete projectiles[idToDestroy];
          }
        });
      });
    }
  });

  socket.on('projectileDestroyed', ({ id }) => {
    if (projectiles[id]) {
      projectiles[id].destroy();
      delete projectiles[id];
    }
  });

  socket.on('state', ({ players: statePlayers, leaderboard, hill }) => {
    statePlayers.forEach(p => {
      addOrUpdatePlayer(p, scene, p.id === selfId);
    });

    const ids = statePlayers.map(p => p.id);
    Object.keys(players).forEach(id => {
      if (!ids.includes(id)) removePlayer(id);
    });

    renderLeaderboard(leaderboard);
    updateKingOfTheHillUI(hill);
  });

  socket.on('hillMoved', (hillZone) => {
    createOrUpdateHillZone(scene, hillZone);
  });
}

function setupMobileControls(scene) {
  const joystickElement = document.getElementById('joystick');
  const joystickArea = document.getElementById('joystick-area');

  joystickArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
    const rect = joystickArea.getBoundingClientRect();
    joystickOrigin.x = rect.left + rect.width / 2;
    joystickOrigin.y = rect.top + rect.height / 2;
    updateJoystickPosition(e.touches[0]);
  });

  document.addEventListener('touchmove', (e) => {
    if (joystickActive) {
      e.preventDefault();
      updateJoystickPosition(e.touches[0]);
    }
  });

  document.addEventListener('touchend', (e) => {
    if (joystickActive) {
      e.preventDefault();
      resetJoystick();
    }
  });

  document.addEventListener('touchcancel', (e) => {
    if (joystickActive) {
      e.preventDefault();
      resetJoystick();
    }
  });

  const shootBtn = document.getElementById('shoot-btn');
  const swingBtn = document.getElementById('swing-btn');

  shootBtn.addEventListener('touchstart', (e) => {
    mobileShoot();
  });

  swingBtn.addEventListener('touchstart', (e) => {
    mobileSwing();
  });
}

function updateJoystickPosition(touch) {
  const joystickElement = document.getElementById('joystick');
  const joystickArea = document.getElementById('joystick-area');

  const rect = joystickArea.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let deltaX = touch.clientX - centerX;
  let deltaY = touch.clientY - centerY;

  const maxDistance = rect.width / 3;
  const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxDistance);
  const angle = Math.atan2(deltaY, deltaX);

  deltaX = Math.cos(angle) * distance;
  deltaY = Math.sin(angle) * distance;

  joystickElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

  const threshold = maxDistance * 0.3;
  mobileInput = {
    left: deltaX < -threshold,
    right: deltaX > threshold,
    up: deltaY < -threshold,
    down: deltaY > threshold
  };
}

function resetJoystick() {
  const joystickElement = document.getElementById('joystick');
  joystickElement.style.transform = 'translate(0, 0)';
  joystickActive = false;
  mobileInput = { left: false, right: false, up: false, down: false };
}

function mobileShoot() {
  const time = Date.now();
  const canShoot = time - lastShootTime > SHOOT_COOLDOWN;

  if (canShoot) {
    const me = players[selfId];
    if (me && me.sprite) {
      let shootVx = 0, shootVy = 0;

      if (mobileInput.left) shootVx -= 1;
      if (mobileInput.right) shootVx += 1;
      if (mobileInput.up) shootVy -= 1;
      if (mobileInput.down) shootVy += 1;

      if (shootVx === 0 && shootVy === 0) {
        shootVx = me.lastDirection.x;
        shootVy = me.lastDirection.y;
      }

      if (shootVx === 0 && shootVy === 0) {
        shootVx = 1;
      }

      const len = Math.hypot(shootVx, shootVy);
      if (len > 0) {
        shootVx = (shootVx / len) * 300;
        shootVy = (shootVy / len) * 300;
      }

      lastShootTime = time;
      const localId = `proj_${selfId}_${Date.now()}`;

      const projectileData = {
        id: localId,
        x: me.sprite.x,
        y: me.sprite.y,
        vx: shootVx,
        vy: shootVy
      };

      if (game) {
        createBeerProjectile(game.scene.scenes[0], projectileData);
        game.scene.scenes[0].sound.play('shoot');
      }

      socket.emit('shoot', {
        ...projectileData,
        localId: localId
      });
    }
  }
}

function mobileSwing() {
  const me = players[selfId];
  if (!me || !me.sprite) return;

  const range = 100;
  let targetId = null;
  let best = 1e9;

  Object.keys(players).forEach(id => {
    if (id === selfId) return;
    const p = players[id];
    if (p && p.sprite) {
      const dx = p.sprite.x - me.sprite.x;
      const dy = p.sprite.y - me.sprite.y;
      const d = Math.hypot(dx, dy);
      if (d < range && d < best) {
        best = d;
        targetId = id;
      }
    }
  });

  if (targetId) {
    socket.emit('input', {
      seq: ++seq,
      left: mobileInput.left,
      right: mobileInput.right,
      up: mobileInput.up,
      down: mobileInput.down,
      action: 'swing',
      targetId,
      ax: me.sprite.x,
      ay: me.sprite.y
    });
  }
}

function addOrUpdatePlayer(p, scene, isSelf) {
  if (!players[p.id]) {
    console.log("Creating new player:", p.name, "at", p.x, p.y);

    const sprite = scene.physics.add.sprite(p.x, p.y, 'beer');
    sprite.setCollideWorldBounds(true);
    sprite.setBounce(0.3);
    sprite.setDrag(100);
    sprite.body.setCircle(22);

    if (isSelf) {
      scene.cameras.main.setZoom(isMobileDevice ? Math.min(window.innerWidth / 800, window.innerHeight / 600) : 1);
      scene.cameras.main.centerOn(p.x, p.y);
    }

    const nameText = scene.add.text(p.x - 24, p.y - 44, p.name, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setDepth(2);

    const hpBarBg = scene.add.rectangle(p.x - 25, p.y - 30, 50, 6, 0x333333).setDepth(2);
    const hpBar = scene.add.rectangle(p.x - 25, p.y - 30, 50, 6, 0x00ff00).setDepth(3);

    players[p.id] = {
      sprite,
      nameText,
      hpBar,
      hpBarBg,
      data: p,
      lastDirection: p.lastDirection || { x: 0, y: 0 },
      lastServerX: p.x,
      lastServerY: p.y,
      lastUpdateTime: Date.now(),
      targetX: p.x,
      targetY: p.y
    };

    Object.keys(players).forEach(id => {
      if (id !== p.id && players[id] && players[id].sprite) {
        scene.physics.add.collider(sprite, players[id].sprite, handlePlayerCollision);
      }
    });

    wallSprites.forEach(wall => {
      scene.physics.add.collider(sprite, wall);
    });

  } else {
    const player = players[p.id];
    player.data = p;
    player.lastDirection = p.lastDirection || player.lastDirection;
    player.targetX = p.x;
    player.targetY = p.y;
    player.lastUpdateTime = Date.now();

    if (isSelf) {
      const dx = player.sprite.x - p.x;
      const dy = player.sprite.y - p.y;
      const distance = Math.hypot(dx, dy);

      if (distance > POSITION_THRESHOLD) {
        player.sprite.x = p.x;
        player.sprite.y = p.y;
        console.log("Position corrected for self player");
      }
    }
  }
}

function handlePlayerCollision(sprite1, sprite2) {
  const angle = Phaser.Math.Angle.Between(sprite1.x, sprite1.y, sprite2.x, sprite2.y);
  const force = 30;

  sprite1.setVelocity(
    Math.cos(angle) * force,
    Math.sin(angle) * force
  );
  sprite2.setVelocity(
    Math.cos(angle + Math.PI) * force,
    Math.sin(angle + Math.PI) * force
  );

  sprite1.setAngularVelocity(100);
  sprite2.setAngularVelocity(-100);

  setTimeout(() => {
    if (sprite1 && sprite1.active) sprite1.setAngularVelocity(0);
    if (sprite2 && sprite2.active) sprite2.setAngularVelocity(0);
  }, 300);
}

function removePlayer(id) {
  const p = players[id];
  if (!p) return;

  if (p.sprite) p.sprite.destroy();
  if (p.nameText) p.nameText.destroy();
  if (p.hpBar) p.hpBar.destroy();
  if (p.hpBarBg) p.hpBarBg.destroy();
  if (p.powerUpAura) p.powerUpAura.destroy();

  delete players[id];
}

function renderLeaderboard(top) {
  const el = document.getElementById('leaderboard-content');
  if (!el) return;

  el.innerHTML = `
    <h3 style="margin:0 0 8px 0; text-align:center; color: #FFD700;">Leaderboard</h3>
    <div style="display: grid; grid-template-columns: 20px 1fr auto auto auto; gap: 5px; align-items: center; font-size: 14px;">
        <span style="font-weight: bold;">#</span>
        <span style="font-weight: bold;">Name</span>
        <span style="font-weight: bold; text-align: right;">Score</span>
        <span style="font-weight: bold; text-align: right;">Kills</span>
        <span style="font-weight: bold; text-align: right;">Damage</span>
        ${top.map((x, i) => `
            <span style="color: ${getRankColor(i)}; font-weight: bold;">${i + 1}.</span>
            <span style="color: ${getRankColor(i)};">${escapeHtml(x.name)}</span>
            <span style="text-align: right;">${x.score}</span>
            <span style="text-align: right;">${x.kills}</span>
            <span style="text-align: right;">${x.damage}</span>
        `).join('')}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getRankColor(i) {
  if (i === 0) return '#FFD700';
  if (i === 1) return '#C0C0C0';
  if (i === 2) return '#CD7F32';
  return '#FFFFFF';
}

function createBeerMugTexture(scene) {
  const graphics = scene.add.graphics();
  const w = 44, h = 44;

  graphics.fillStyle(0xcce0ff, 0.4);
  graphics.fillEllipse(w / 2, h / 2, 38, 40);

  graphics.fillStyle(0xFFC700, 0.9);
  graphics.fillEllipse(w / 2, h/2 + 5, 34, 32);

  graphics.fillStyle(0xFFFFFF, 1);
  graphics.fillEllipse(w / 2, h/2 - 12, 32, 12);
  graphics.fillCircle(w / 2 - 10, h / 2 - 15, 5);
  graphics.fillCircle(w / 2 + 8, h / 2 - 14, 6);

  graphics.lineStyle(6, 0xcce0ff, 0.3);
  graphics.beginPath();
  graphics.arc(w - 5, h/2, 10, Math.PI / 2, -Math.PI / 2, true);
  graphics.strokePath();

  graphics.fillStyle(0xFFFFFF, 0.5);
  graphics.fillEllipse(w/2 - 8, h/2 - 5, 4, 15);

  graphics.generateTexture('beer', w, h);
  graphics.destroy();
}

function createBeerProjectileTexture(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0xFFD700);
  graphics.fillEllipse(8, 10, 12, 8);
  graphics.fillStyle(0xFF8C00);
  graphics.fillEllipse(8, 8, 8, 6);
  graphics.fillStyle(0xFFFFFF);
  graphics.fillEllipse(8, 6, 4, 3);

  graphics.generateTexture('beerProjectile', 16, 16);
  graphics.destroy();
}

function createBushTexture(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x228B22, 0.8);
  graphics.fillEllipse(32, 32, 60, 40);
  graphics.fillEllipse(12, 25, 40, 30);
  graphics.fillEllipse(52, 25, 40, 30);

  graphics.lineStyle(2, 0x006400);
  graphics.beginPath();
  graphics.arc(32, 32, 30, 0, Math.PI * 2, true);
  graphics.strokePath();

  graphics.generateTexture('bushTexture', 64, 64);
  graphics.destroy();
}

function createBushes(scene, bushesData) {
  bushes = bushesData;
  bushSprites = [];

  bushes.forEach(bush => {
    const bushSprite = scene.add.sprite(bush.x, bush.y, 'bushTexture');
    bushSprite.setDepth(1);
    scene.physics.add.existing(bushSprite, true);
    if (bushSprite.body) {
      bushSprite.body.setCircle(32);
    }
    bushSprites.push(bushSprite);
  });
}

function createTreeTexture(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x8B4513);
  graphics.fillRect(28, 40, 8, 24);

  graphics.fillStyle(0x228B22);
  graphics.fillEllipse(32, 24, 50, 40);
  graphics.fillEllipse(20, 30, 30, 20);
  graphics.fillEllipse(44, 30, 30, 20);

  graphics.generateTexture('treeTexture', 64, 64);
  graphics.destroy();
}

function createTrees(scene, treesData) {
  trees = treesData;
  treeSprites = [];

  trees.forEach(tree => {
    const treeSprite = scene.add.sprite(tree.x, tree.y, 'treeTexture');
    treeSprite.setDepth(2);
    treeSprites.push(treeSprite);
  });
}

function createPowerUpTextures(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0xFFFF00);
  graphics.beginPath();
  graphics.moveTo(10, 0); graphics.lineTo(4, 12); graphics.lineTo(8, 12);
  graphics.lineTo(2, 24); graphics.lineTo(12, 10); graphics.lineTo(8, 10);
  graphics.closePath();
  graphics.fillPath();
  graphics.generateTexture('powerup_speed', 16, 24);
  graphics.clear();

  graphics.fillStyle(0xFF0000);
  graphics.fillRect(7, 0, 2, 18);
  graphics.fillRect(4, 12, 8, 2);
  graphics.generateTexture('powerup_damage', 16, 24);
  graphics.destroy();
}

function createBottleTexture(scene) {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x3A1F04);
  graphics.fillRoundedRect(4, 0, 8, 20, 2);
  graphics.fillStyle(0xFFD700);
  graphics.fillRect(2, 8, 12, 6);
  graphics.generateTexture('bottle', 16, 24);
  graphics.destroy();

  const particleGraphics = scene.add.graphics();
  particleGraphics.fillStyle(0x8B4513, 0.7);
  particleGraphics.fillRect(0, 0, 4, 4);
  particleGraphics.generateTexture('glassParticle', 4, 4);
  particleGraphics.destroy();
}

function createPowerUp(scene, powerUpData) {
  const texture = powerUpData.type === 'speed' ? 'powerup_speed' : 'powerup_damage';
  const sprite = scene.add.sprite(powerUpData.x, powerUpData.y, texture);
  sprite.setDepth(1);
  powerUpSprites[powerUpData.id] = sprite;

  scene.tweens.add({
    targets: sprite,
    scaleX: 1.2,
    scaleY: 1.2,
    duration: 500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
}

function createOrUpdateHillZone(scene, hillZone) {
  if (!hillZoneSprite) {
    hillZoneSprite = scene.add.circle(hillZone.x, hillZone.y, hillZone.radius);
    hillZoneSprite.setStrokeStyle(4, 0xFFD700, 0.5);
    hillZoneSprite.setDepth(-1);
  } else {
    hillZoneSprite.setPosition(hillZone.x, hillZone.y);
  }
}

function updateKingOfTheHillUI(hillData) {
  if (!hillZoneSprite || !hillData) return;

  let color = 0xFFD700;
  let alpha = 0.3;

  if (hillData.contested) {
    color = 0xFF4500;
    alpha = 0.5;
  } else if (hillData.controller) {
    color = 0x00FF00;
    alpha = 0.4;
  }

  hillZoneSprite.setFillStyle(color, alpha);

  const uiElement = document.getElementById('king-of-the-hill');
  if (uiElement) {
    const king = hillData.king ? players[hillData.king] : null;
    if (king && king.data) {
      const time = Math.floor(king.data.hillTime);
      uiElement.innerHTML = `
        <h3 style="margin:0; color: #FFD700;">King of the Hill</h3>
        <div>👑 ${escapeHtml(king.data.name)}</div>
        <div>⏱️ ${time}s</div>
      `;
      uiElement.style.display = 'block';
    } else {
      uiElement.style.display = 'none';
    }
  }
}

function createWallTexture(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x8B4513);
  graphics.fillRect(0, 0, 64, 64);

  graphics.lineStyle(2, 0x654321);
  for (let x = 0; x < 64; x += 16) {
    graphics.moveTo(x, 0);
    graphics.lineTo(x, 64);
  }
  for (let y = 0; y < 64; y += 8) {
    graphics.moveTo(0, y);
    graphics.lineTo(64, y);
  }
  graphics.strokePath();

  graphics.generateTexture('wallTexture', 64, 64);
  graphics.destroy();
}

function createWalls(scene, wallsData) {
  walls = wallsData;
  wallSprites = [];

  walls.forEach(wall => {
    const wallSprite = scene.add.rectangle(wall.x, wall.y, wall.width, wall.height, 0x8B4513);
    wallSprite.setRotation(wall.angle * Math.PI / 180);
    wallSprite.setDepth(1);
    scene.physics.add.existing(wallSprite, true);

    const texture = scene.add.tileSprite(wall.x, wall.y, wall.width, wall.height, 'wallTexture');
    texture.setRotation(wall.angle * Math.PI / 180);
    texture.setDepth(1);
    texture.setAlpha(0.8);

    wallSprites.push(wallSprite);
  });
}

function createBeerProjectile(scene, projectileData) {
  const texture = projectileData.type === 'bottle' ? 'bottle' : 'beerProjectile';
  try {
    if (projectiles[projectileData.id]) {
      projectiles[projectileData.id].destroy();
    }

    const projectile = scene.physics.add.sprite(projectileData.x, projectileData.y, 'beerProjectile');
    projectile.setVelocity(projectileData.vx, projectileData.vy);
    projectile.setCollideWorldBounds(true);
    projectile.setBounce(0.5);
    projectile.setDrag(50);
    projectile.id = projectileData.id;

    scene.tweens.add({
      targets: projectile,
      angle: 360,
      duration: 1000,
      repeat: -1,
      ease: 'Linear'
    });

    scene.time.delayedCall(3000, () => {
      if (projectiles[projectileData.id]) {
        projectiles[projectileData.id].destroy();
        delete projectiles[projectileData.id];
      }
    });

    projectiles[projectileData.id] = projectile;
    return projectile;
  } catch (error) {
    console.error("Error creating projectile:", error);
    return null;
  }
}

function update(time, delta) {
  const allX = Object.values(players).map(p => p.sprite.x);
  const allY = Object.values(players).map(p => p.sprite.y);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  scene.cameras.main.centerOn(centerX, centerY);
  if (!selfId) return;

  let input;

  if (isMobileDevice) {
    input = {
      seq: ++seq,
      left: mobileInput.left,
      right: mobileInput.right,
      up: mobileInput.up,
      down: mobileInput.down,
      action: null
    };
  } else {
    input = {
      seq: ++seq,
      left: cursors.left.isDown,
      right: cursors.right.isDown,
      up: cursors.up.isDown,
      down: cursors.down.isDown,
      action: swingKey.isDown ? 'swing' : null
    };

    const canShoot = time - lastShootTime > SHOOT_COOLDOWN;
    if (shootKey.isDown && canShoot) {
      const me = players[selfId];
      if (me && me.sprite) {
        let shootVx = 0, shootVy = 0;
        if (input.left) shootVx -= 1;
        if (input.right) shootVx += 1;
        if (input.up) shootVy -= 1;
        if (input.down) shootVy += 1;

        if (shootVx === 0 && shootVy === 0) {
          shootVx = me.lastDirection.x;
          shootVy = me.lastDirection.y;
        }

        if (shootVx === 0 && shootVy === 0) {
          shootVx = 1;
        }

        const len = Math.hypot(shootVx, shootVy);
        if (len > 0) {
          shootVx = (shootVx / len) * 300;
          shootVy = (shootVy / len) * 300;
        }

        lastShootTime = time;
        const localId = `proj_${selfId}_${Date.now()}`;

        const projectileData = {
          id: localId,
          x: me.sprite.x,
          y: me.sprite.y,
          vx: shootVx,
          vy: shootVy
        };

        createBeerProjectile(scene, projectileData);
        scene.sound.play('shoot');

        socket.emit('shoot', {
          ...projectileData,
          localId: localId
        });
      }
    }
  }

  const speed = 200;
  let vx = 0, vy = 0;
  if (input.left) vx -= 1;
  if (input.right) vx += 1;
  if (input.up) vy -= 1;
  if (input.down) vy += 1;

  const len = Math.hypot(vx, vy);
  if (len > 0) {
    vx = vx / len * speed;
    vy = vy / len * speed;
  } else {
    vx = 0;
    vy = 0;
  }

  const me = players[selfId];
  if (me && me.sprite) {
    if (vx !== 0 || vy !== 0) {
      me.lastDirection.x = vx / speed;
      me.lastDirection.y = vy / speed;
    }

    me.sprite.setVelocity(vx, vy);

    me.nameText.x = me.sprite.x - 24;
    me.nameText.y = me.sprite.y - 44;
    me.hpBarBg.x = me.sprite.x - 25;
    me.hpBarBg.y = me.sprite.y - 30;
    me.hpBar.x = me.sprite.x - 25;
    me.hpBar.y = me.sprite.y - 30;

    if (vx !== 0 || vy !== 0) {
      const angle = Math.atan2(vy, vx) * (180 / Math.PI);
      scene.tweens.add({
        targets: me.sprite,
        angle: angle * 0.3,
        duration: 200,
        ease: 'Power2'
      });
    }
  }

  if (time - lastInputTime >= 1000 / INPUT_SEND_RATE) {
    if (input.action) {
      const range = 100;
      let targetId = null;
      let best = 1e9;

      if (me && me.sprite) {
        Object.keys(players).forEach(id => {
          if (id === selfId) return;
          const p = players[id];
          if (p && p.sprite) {
            const dx = p.sprite.x - me.sprite.x;
            const dy = p.sprite.y - me.sprite.y;
            const d = Math.hypot(dx, dy);
            if (d < range && d < best) {
              best = d;
              targetId = id;
            }
          }
        });
      }

      if (targetId) {
        socket.emit('input', {
          seq,
          left: input.left,
          right: input.right,
          up: input.up,
          down: input.down,
          action: 'swing',
          targetId,
          ax: me ? me.sprite.x : 0,
          ay: me ? me.sprite.y : 0
        });
      } else {
        socket.emit('input', { seq, ...input });
      }
    } else {
      socket.emit('input', { seq, ...input });
    }
    lastInputTime = time;
  }

  Object.keys(players).forEach(id => {
    const p = players[id];
    if (!p || !p.data || !p.sprite) return;

    if (id !== selfId) {
      const dx = p.targetX - p.sprite.x;
      const dy = p.targetY - p.sprite.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 5) {
        p.sprite.x += dx * 0.15;
        p.sprite.y += dy * 0.15;
      } else {
        p.sprite.x = p.targetX;
        p.sprite.y = p.targetY;
      }
    }

    p.nameText.x = p.sprite.x - 24;
    p.nameText.y = p.sprite.y - 44;
    p.hpBarBg.x = p.sprite.x - 25;
    p.hpBarBg.y = p.sprite.y - 30;
    p.hpBar.x = p.sprite.x - 25;
    p.hpBar.y = p.sprite.y - 30;

    const hpPercentage = Math.max(0, p.data.hp / 100);
    const hpWidth = hpPercentage * 50;
    p.hpBar.width = hpWidth;

    if (p.data.hp > 60) p.hpBar.fillColor = 0x00ff00;
    else if (p.data.hp > 30) p.hpBar.fillColor = 0xffa500;
    else p.hpBar.fillColor = 0xff0000;

    let inBush = false;
    for (const bush of bushSprites) {
      if (p.sprite.body && Phaser.Geom.Intersects.RectangleToRectangle(p.sprite.getBounds(), bush.getBounds())) {
        inBush = true;
        break;
      }
    }

    if (!p.data.alive) {
      p.sprite.setAlpha(0.4);
      p.nameText.setAlpha(0);
      p.hpBar.setAlpha(0);
      p.hpBarBg.setAlpha(0);
    } else if (inBush) {
      if (id !== selfId) {
        p.sprite.setAlpha(0.3);
        p.nameText.setAlpha(0);
        p.hpBar.setAlpha(0);
        p.hpBarBg.setAlpha(0);
      } else {
        p.sprite.setAlpha(0.7);
        p.nameText.setAlpha(1);
        p.hpBar.setAlpha(1);
        p.hpBarBg.setAlpha(1);
      }
    } else {
      p.sprite.setAlpha(1);
      p.nameText.setAlpha(1);
      p.hpBar.setAlpha(1);
      p.hpBarBg.setAlpha(1);
    }

    if (p.data.activePowerUp) {
      const color = p.data.activePowerUp === 'speed' ? 0xFFFF00 : 0xFF0000;
      const now = Date.now();
      const a = 0.5 + Math.sin(now / 150) * 0.5;
      if (!p.powerUpAura) {
        p.powerUpAura = scene.add.ellipse(p.sprite.x, p.sprite.y, 40, 40, color, 0.3);
        p.powerUpAura.setDepth(p.sprite.depth - 1);
      }
      p.powerUpAura.x = p.sprite.x;
      p.powerUpAura.y = p.sprite.y;
      p.powerUpAura.setAlpha(a);
      p.powerUpAura.setStrokeStyle(2, color, 0.8);
    } else if (p.powerUpAura) {
      p.powerUpAura.destroy();
      p.powerUpAura = null;
    }
  });
}

window.addEventListener('load', () => {
  console.log("Window loaded, creating Phaser game...");
  game = new Phaser.Game(config);
});

window.addEventListener('resize', () => {
  if (game) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});