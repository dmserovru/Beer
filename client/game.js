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
let wallSprites = []; // Массив для хранения спрайтов стен
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
  
  // Определяем тип устройства
  isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobileDevice) {
    // Показываем мобильные элементы управления
    document.getElementById('mobile-controls').style.display = 'flex';
    setupMobileControls();
  } else {
    // Используем клавиатуру для десктопов
    cursors = scene.input.keyboard.createCursorKeys();
    swingKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    shootKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    console.log("Keys configured:", { swingKey, shootKey });
  }

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
    
    // Create walls, bushes, trees and set world bounds
    if (data.worldSize) {
        scene.physics.world.setBounds(0, 0, data.worldSize.width, data.worldSize.height);
        
        // Create a background grid
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
      addOrUpdateRemotePlayer(data.self, scene);
      
      // Add collision between player and walls
      const me = players[selfId];
      if (me) {
        wallSprites.forEach(wall => {
          scene.physics.add.collider(me.sprite, wall);
        });
      }
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
    
    // Add collision for new player with walls
    const newPlayer = players[player.id];
    if (newPlayer) {
      wallSprites.forEach(wall => {
        scene.physics.add.collider(newPlayer.sprite, wall);
      });
    }
  });

  socket.on('playerLeft', ({ id }) => {
    removePlayer(id);
  });

  socket.on('playerDied', ({ id, by }) => {
    const p = players[id];
    if (p) {
      // Death animation - only change alpha and rotation, not scale
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
    // Create beer splash effect
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

  socket.on('powerUpSpawned', (powerUp) => {
    const scene = game.scene.scenes[0];
    if (scene) createPowerUp(scene, powerUp);
  });

  socket.on('powerUpCollected', ({ powerUpId, playerId }) => {
    if (powerUpSprites[powerUpId]) {
        powerUpSprites[powerUpId].destroy();
        delete powerUpSprites[powerUpId];
    }
    const player = players[playerId];
    if (player) {
        // You can add a visual effect to the player here
    }
  });

  socket.on('projectileShattered', ({ id, x, y, type }) => {
    if (projectiles[id]) {
        projectiles[id].destroy();
        delete projectiles[id];
    }

    const scene = game.scene.scenes[0];
    if (scene) {
        // Create shatter effect
        scene.sound.play('shatter');
        const particles = scene.add.particles('glassParticle');
        const emitter = particles.createEmitter({
            x, y,
            speed: { min: -200, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 500,
            gravityY: 300
        });
        emitter.explode(20);
        scene.time.delayedCall(1000, () => particles.destroy());
    }
  });

  socket.on('hillMoved', (hillZone) => {
    const scene = game.scene.scenes[0];
    if (scene) createOrUpdateHillZone(scene, hillZone);
  });

  socket.on('projectileCreated', (projectile) => {
    const scene = game.scene.scenes[0];
    if (!scene) return;
    
    // Client-side prediction reconciliation
    if (projectile.playerId === selfId && projectile.localId && projectiles[projectile.localId]) {
        const localProj = projectiles[projectile.localId];
        delete projectiles[projectile.localId];

        localProj.id = projectile.id;
        projectiles[projectile.id] = localProj;
        
        // No need to create a new sprite, just re-key the existing one.
        return;
    }
    
    // Create sprite for projectiles from other players (or if prediction failed)
    const projSprite = createBeerProjectile(scene, projectile);
    if (!projSprite) return; // Could be a bottle handled differently
    
    // Add collision between projectile and walls
    if (projSprite) {
      wallSprites.forEach(wall => {
        scene.physics.add.collider(projSprite, wall, (projectileSprite, wallSprite) => {
          // On collision, destroy the projectile
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
      addOrUpdateRemotePlayer(p, scene);
    });
    
    const ids = statePlayers.map(p => p.id);
    Object.keys(players).forEach(id => {
      if (!ids.includes(id)) removePlayer(id);
    });
    
    renderLeaderboard(leaderboard);
    updateKingOfTheHillUI(hill);
  });
}

function setupMobileControls() {
  // Настройка джойстика
  const joystickElement = document.getElementById('joystick');
  const joystickArea = document.getElementById('joystick-area');
  
  // Обработка касаний для джойстика
  joystickElement.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joystickActive = true;
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
  
  // Обработка кнопок действия
  const shootBtn = document.getElementById('shoot-btn');
  const swingBtn = document.getElementById('swing-btn');
  
  shootBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mobileShoot();
  });
  
  swingBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mobileSwing();
  });
}

function updateJoystickPosition(touch) {
  const joystickElement = document.getElementById('joystick');
  const joystickArea = document.getElementById('joystick-area');
  
  const joystickRect = joystickArea.getBoundingClientRect();
  const centerX = joystickRect.left + joystickRect.width / 2;
  const centerY = joystickRect.top + joystickRect.height / 2;
  
  let deltaX = touch.clientX - centerX;
  let deltaY = touch.clientY - centerY;
  
  // Ограничиваем движение джойстика круглой областью
  const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), joystickRect.width / 2);
  const angle = Math.atan2(deltaY, deltaX);
  
  deltaX = Math.cos(angle) * distance;
  deltaY = Math.sin(angle) * distance;
  
  // Обновляем позицию джойстика
  joystickElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  
  // Обновляем входные данные для движения
  const threshold = 10; // Порог для регистрации движения
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
    console.log("MOBILE SHOOTING!");
    const me = players[selfId];
    if (me) {
      // Используем последнее направление движения для стрельбы
      let shootVx = 0, shootVy = 0;
      
      if (mobileInput.left) shootVx -= 1;
      if (mobileInput.right) shootVx += 1;
      if (mobileInput.up) shootVy -= 1;
      if (mobileInput.down) shootVy += 1;
      
      // Если не двигаемся, используем последнее направление
      if (shootVx === 0 && shootVy === 0) {
        shootVx = me.lastDirection.x;
        shootVy = me.lastDirection.y;
      }
      
      // Если все еще нет направления, стреляем вправо
      if (shootVx === 0 && shootVy === 0) {
        shootVx = 1;
      }
      
      // Нормализуем и устанавливаем скорость
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

      // Create projectile locally for prediction
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
  if (!me) return;
  
  const range = 100;
  let targetId = null;
  let best = 1e9;
  
  Object.keys(players).forEach(id => {
    if (id === selfId) return;
    const p = players[id];
    const dx = p.sprite.x - me.sprite.x;
    const dy = p.sprite.y - me.sprite.y;
    const d = Math.hypot(dx, dy);
    if (d < range && d < best) { 
      best = d; 
      targetId = id; 
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

function addOrUpdateRemotePlayer(p, scene) {
  if (!players[p.id]) {
    console.log("Creating new player:", p.name, "at", p.x, p.y);
    const sprite = scene.physics.add.sprite(p.x, p.y, 'beer');
    
    // ВАЖНО: Следим камерой только за СВОИМ игроком
    if (p.id === selfId) {
      scene.cameras.main.startFollow(sprite);
    }
    
    sprite.setCollideWorldBounds(true);
    sprite.setBounce(0.3);
    sprite.setDrag(100);
    sprite.body.setCircle(22); // Устанавливаем круглую форму коллизии
    
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
      lastDirection: p.lastDirection || { x: 0, y: 0 } 
    };
    console.log("Player created successfully:", p.name);
    
    // Add collision between players
    Object.keys(players).forEach(id => {
      if (id !== p.id && players[id]) {
        scene.physics.add.collider(sprite, players[id].sprite, (sprite1, sprite2) => {
          handlePlayerCollision(sprite1, sprite2);
        });
      }
    });
    
    // Add collision with walls for new player
    wallSprites.forEach(wall => {
      scene.physics.add.collider(sprite, wall);
    });
  } else {
    players[p.id].data = p;
    players[p.id].lastDirection = p.lastDirection || players[p.id].lastDirection;
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
  p.sprite.destroy();
  p.nameText.destroy();
  p.hpBar.destroy();
  p.hpBarBg.destroy();
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
    if (i === 0) return '#FFD700'; // Gold
    if (i === 1) return '#C0C0C0'; // Silver
    if (i === 2) return '#CD7F32'; // Bronze
    return '#FFFFFF'; // White for others
}

function createBeerMugTexture(scene) {
  const graphics = scene.add.graphics();
  const w = 44, h = 44;

  // Glass body
  graphics.fillStyle(0xcce0ff, 0.4); // Light blue, semi-transparent for glass
  graphics.fillEllipse(w / 2, h / 2, 38, 40);

  // Beer inside
  graphics.fillStyle(0xFFC700, 0.9); // Amber color
  graphics.fillEllipse(w / 2, h/2 + 5, 34, 32);

  // Foam
  graphics.fillStyle(0xFFFFFF, 1);
  graphics.fillEllipse(w / 2, h/2 - 12, 32, 12);
  graphics.fillCircle(w / 2 - 10, h / 2 - 15, 5);
  graphics.fillCircle(w / 2 + 8, h / 2 - 14, 6);
  
  // Handle
  graphics.lineStyle(6, 0xcce0ff, 0.3); // Thicker, glassy handle
  graphics.beginPath();
  graphics.arc(w - 5, h/2, 10, Math.PI / 2, -Math.PI / 2, true);
  graphics.strokePath();

  // Glass highlight
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
  
  graphics.fillStyle(0x228B22, 0.8); // ForestGreen with some transparency
  graphics.fillEllipse(32, 32, 60, 40);
  graphics.fillEllipse(12, 25, 40, 30);
  graphics.fillEllipse(52, 25, 40, 30);

  graphics.lineStyle(2, 0x006400); // DarkGreen
  graphics.beginPath();
  graphics.arc(32, 32, 30, 0, Math.PI * 2, true);
  graphics.strokePath();
  
  graphics.generateTexture('bushTexture', 64, 64);
  graphics.destroy();
}

function createBushes(scene, bushesData) {
  bushes = bushesData;
  bushSprites = []; // Clear the array of bushes
  
  bushes.forEach(bush => {
    const bushSprite = scene.add.sprite(bush.x, bush.y, 'bushTexture');
    bushSprite.setDepth(1);
    
    // Add physics body for overlap check, but not for collision
    scene.physics.add.existing(bushSprite, true); // true = static body
    if (bushSprite.body) {
        bushSprite.body.setCircle(32);
    }
    
    bushSprites.push(bushSprite);
  });
}

function createTreeTexture(scene) {
  const graphics = scene.add.graphics();
  
  // Trunk
  graphics.fillStyle(0x8B4513); // SaddleBrown
  graphics.fillRect(28, 40, 8, 24);

  // Leaves
  graphics.fillStyle(0x228B22); // ForestGreen
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

    // Speed Boost (lightning bolt)
    graphics.fillStyle(0xFFFF00); // Yellow
    graphics.beginPath();
    graphics.moveTo(10, 0); graphics.lineTo(4, 12); graphics.lineTo(8, 12); 
    graphics.lineTo(2, 24); graphics.lineTo(12, 10); graphics.lineTo(8, 10);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture('powerup_speed', 16, 24);
    graphics.clear();

    // Damage Boost (sword)
    graphics.fillStyle(0xFF0000); // Red
    graphics.fillRect(7, 0, 2, 18);
    graphics.fillRect(4, 12, 8, 2);
    graphics.generateTexture('powerup_damage', 16, 24);
    graphics.destroy();
}

function createBottleTexture(scene) {
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x3A1F04); // Dark brown for bottle
    graphics.fillRoundedRect(4, 0, 8, 20, 2);
    graphics.fillStyle(0xFFD700); // Gold label
    graphics.fillRect(2, 8, 12, 6);
    graphics.generateTexture('bottle', 16, 24);
    graphics.destroy();

    // Also create a particle for shattering effect
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

    // Add a pulsing tween
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

    let color = 0xFFD700; // Gold for neutral
    let alpha = 0.3;

    if (hillData.contested) {
        color = 0xFF4500; // OrangeRed for contested
        alpha = 0.5;
    } else if (hillData.controller) {
        color = 0x00FF00; // Green for controlled
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
  wallSprites = []; // Очищаем массив стен
  
  walls.forEach(wall => {
    // Создаем физический объект стены
    const wallSprite = scene.add.rectangle(wall.x, wall.y, wall.width, wall.height, 0x8B4513);
    wallSprite.setRotation(wall.angle * Math.PI / 180);
    wallSprite.setDepth(1);
    
    // Добавляем физическое тело для коллизий
    scene.physics.add.existing(wallSprite, true); // true = static body
    
    // Добавляем текстуру к стене
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
    
    // Удаляем снаряд через 3 секунды
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
  const scene = this;
  if (!selfId) return;
  
  let input;
  
  if (isMobileDevice) {
    // Используем мобильный ввод
    input = { 
      seq: ++seq,
      left: mobileInput.left,
      right: mobileInput.right,
      up: mobileInput.up,
      down: mobileInput.down,
      action: null
    };
  } else {
    // Используем клавиатурный ввод
    input = { 
      seq: ++seq,
      left: cursors.left.isDown,
      right: cursors.right.isDown,
      up: cursors.up.isDown,
      down: cursors.down.isDown,
      action: swingKey.isDown ? 'swing' : null
    };
    
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
        
        lastShootTime = time;
        const localId = `proj_${selfId}_${Date.now()}`;

        const projectileData = {
            id: localId,
            x: me.sprite.x,
            y: me.sprite.y,
            vx: shootVx,
            vy: shootVy
        };

        // Create projectile locally for prediction
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
    if (vx !== 0 || vy !== 0) {
      me.lastDirection.x = vx / speed;
      me.lastDirection.y = vy / speed;
    }
    
    // Используем физику Phaser для движения вместо ручного обновления позиции
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

  Object.keys(players).forEach(id => {
    const p = players[id];
    if (!p.data) return;
    
    if (id === selfId) {
      p.nameText.x = p.sprite.x - 24;
      p.nameText.y = p.sprite.y - 44;
      p.hpBarBg.x = p.sprite.x - 25;
      p.hpBarBg.y = p.sprite.y - 30;
      p.hpBar.x = p.sprite.x - 25;
      p.hpBar.y = p.sprite.y - 30;
    } else {
      const lerpFactor = Math.min(0.3, delta / 16.67);
      p.sprite.x = Phaser.Math.Linear(p.sprite.x, p.data.x, lerpFactor);
      p.sprite.y = Phaser.Math.Linear(p.sprite.y, p.data.y, lerpFactor);
      
      p.nameText.x = p.sprite.x - 24;
      p.nameText.y = p.sprite.y - 44;
      p.hpBarBg.x = p.sprite.x - 25;
      p.hpBarBg.y = p.sprite.y - 30;
      p.hpBar.x = p.sprite.x - 25;
      p.hpBar.y = p.sprite.y - 30;
    }
    
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

    // Visual effect for active power-up
    if (p.data.activePowerUp) {
        const color = p.data.activePowerUp === 'speed' ? 0xFFFF00 : 0xFF0000;
        const now = Date.now();
        const a = 0.5 + Math.sin(now / 150) * 0.5; // Pulsating alpha
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
  console.log("Phaser game created:", game);
});

// Добавьте обработку изменения размера окна
window.addEventListener('resize', () => {
  if (game) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});