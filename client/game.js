function getRankColor(index) {
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#FFFFFF'];
  return colors[index] || '#FFFFFF';
}

// Создание текстур
function createBeerMugTexture(scene) {
  const graphics = scene.add.graphics();
  const w = 44, h = 44;

  graphics.fillStyle(0x87CEEB, 0.6);
  graphics.fillEllipse(w / 2, h / 2, 38, 40);

  graphics.fillStyle(0xFFB000, 0.9);
  graphics.fillEllipse(w / 2, h/2 + 4, 34, 30);

  graphics.fillStyle(0xFFFFFF, 0.95);
  graphics.fillEllipse(w / 2, h/2 - 10, 32, 14);
  
  graphics.fillCircle(w / 2 - 8, h / 2 - 12, 3);
  graphics.fillCircle(w / 2 + 6, h / 2 - 14, 4);
  graphics.fillCircle(w / 2 + 2, h / 2 - 8, 2);

  graphics.lineStyle(4, 0x87CEEB, 0.7);
  graphics.beginPath();
  graphics.arc(w - 6, h/2, 12, Math.PI / 2, -Math.PI / 2, true);
  graphics.strokePath();

  graphics.fillStyle(0xFFFFFF, 0.3);
  graphics.fillEllipse(w/2 - 6, h/2 - 8, 6, 20);

  graphics.generateTexture('beer', w, h);
  graphics.destroy();
}

function createBeerProjectileTexture(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0xFFB000, 0.9);
  graphics.fillEllipse(8, 8, 14, 12);
  
  graphics.fillStyle(0xFFFFFF, 0.8);
  graphics.fillEllipse(8, 6, 8, 6);
  
  graphics.fillStyle(0xFFFFFF, 0.6);
  graphics.fillEllipse(6, 5, 3, 3);

  graphics.generateTexture('beerProjectile', 16, 16);
  graphics.destroy();
}

function createWallTexture(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x8B4513);
  graphics.fillRect(0, 0, 64, 64);

  graphics.lineStyle(1, 0x654321, 0.8);
  for (let y = 0; y < 64; y += 16) {
    graphics.moveTo(0, y);
    graphics.lineTo(64, y);
  }
  for (let x = 0; x < 64; x += 32) {
    graphics.moveTo(x, 0);
    graphics.lineTo(x, 64);
  }
  
  graphics.lineStyle(2, 0x5D4E37, 0.6);
  for (let y = 16; y < 64; y += 16) {
    graphics.moveTo(0, y);
    graphics.lineTo(64, y);
  }
  
  graphics.strokePath();
  graphics.generateTexture('wallTexture', 64, 64);
  graphics.destroy();
}

function createBushTexture(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x228B22, 0.8);
  graphics.fillEllipse(32, 35, 55, 35);
  graphics.fillEllipse(15, 30, 35, 25);
  graphics.fillEllipse(49, 30, 35, 25);
  graphics.fillEllipse(32, 20, 40, 25);

  graphics.fillStyle(0x006400, 0.4);
  graphics.fillEllipse(20, 32, 20, 15);
  graphics.fillEllipse(44, 32, 20, 15);

  graphics.lineStyle(1, 0x006400, 0.6);
  graphics.beginPath();
  graphics.arc(32, 32, 28, 0, Math.PI * 2);
  graphics.strokePath();

  graphics.generateTexture('bushTexture', 64, 64);
  graphics.destroy();
}

function createTreeTexture(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x8B4513);
  graphics.fillRect(26, 35, 12, 25);
  
  graphics.lineStyle(1, 0x654321, 0.5);
  graphics.moveTo(28, 35);
  graphics.lineTo(28, 60);
  graphics.moveTo(36, 35);
  graphics.lineTo(36, 60);
  graphics.strokePath();

  graphics.fillStyle(0x228B22, 0.9);
  graphics.fillEllipse(32, 25, 45, 35);
  graphics.fillEllipse(22, 28, 25, 20);
  graphics.fillEllipse(42, 28, 25, 20);
  
  graphics.fillStyle(0x006400, 0.3);
  graphics.fillEllipse(25, 30, 15, 12);
  graphics.fillEllipse(39, 30, 15, 12);

  graphics.generateTexture('treeTexture', 64, 64);
  graphics.destroy();
}

function createPowerUpTextures(scene) {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0xFFFF00, 0.9);
  graphics.beginPath();
  graphics.moveTo(12, 2);
  graphics.lineTo(6, 10);
  graphics.lineTo(10, 10);
  graphics.lineTo(4, 22);
  graphics.lineTo(14, 12);
  graphics.lineTo(10, 12);
  graphics.closePath();
  graphics.fillPath();
  
  graphics.lineStyle(1, 0xFFD700, 0.8);
  graphics.strokePath();
  
  graphics.generateTexture('powerup_speed', 18, 24);
  graphics.clear();

  graphics.fillStyle(0xFF4444, 0.9);
  graphics.fillRect(8, 2, 2, 20);
  graphics.fillRect(2, 11, 14, 2);
  
  graphics.lineStyle(1, 0xCC0000, 0.8);
  graphics.strokeRect(8, 2, 2, 20);
  graphics.strokeRect(2, 11, 14, 2);
  
  graphics.generateTexture('powerup_damage', 18, 24);
  graphics.destroy();
}

function createBottleTexture(scene) {
  const graphics = scene.add.graphics();
  
  graphics.fillStyle(0x4A4A4A, 0.8);
  graphics.fillRoundedRect(6, 4, 4, 16, 1);
  
  graphics.fillStyle(0x3A3A3A, 0.9);
  graphics.fillRect(7, 0, 2, 6);
  
  graphics.fillStyle(0xFFD700, 0.7);
  graphics.fillRect(4, 8, 8, 6);
  
  graphics.fillStyle(0xFFFFFF, 0.3);
  graphics.fillRect(8, 6, 1, 10);

  graphics.generateTexture('bottle', 16, 24);
  graphics.destroy();
}

// Создание объектов мира
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
    texture.setAlpha(0.9);

    wallSprites.push(wallSprite);
  });
}

function createBushes(scene, bushesData) {
  bushes = bushesData;
  bushSprites = [];

  bushes.forEach(bush => {
    const bushSprite = scene.add.sprite(bush.x, bush.y, 'bushTexture');
    bushSprite.setDepth(0.5);
    bushSprite.setAlpha(0.8);
    
    scene.physics.add.existing(bushSprite, true);
    if (bushSprite.body) {
      bushSprite.body.setCircle(30);
    }
    
    bushSprites.push(bushSprite);
  });
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

function createPowerUp(scene, powerUpData) {
  const texture = powerUpData.type === 'speed' ? 'powerup_speed' : 'powerup_damage';
  const sprite = scene.add.sprite(powerUpData.x, powerUpData.y, texture);
  sprite.setDepth(3);
  powerUpSprites[powerUpData.id] = sprite;

  scene.tweens.add({
    targets: sprite,
    scaleX: 1.3,
    scaleY: 1.3,
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  scene.tweens.add({
    targets: sprite,
    rotation: Math.PI * 2,
    duration: 3000,
    repeat: -1,
    ease: 'Linear'
  });
}

function createOrUpdateHillZone(scene, hillZone) {
  if (!hillZoneSprite) {
    hillZoneSprite = scene.add.circle(hillZone.x, hillZone.y, hillZone.radius, 0xFFD700, 0.2);
    hillZoneSprite.setStrokeStyle(3, 0xFFD700, 0.6);
    hillZoneSprite.setDepth(-1);
    
    scene.tweens.add({
      targets: hillZoneSprite,
      alpha: 0.4,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  } else {
    scene.tweens.add({
      targets: hillZoneSprite,
      x: hillZone.x,
      y: hillZone.y,
      duration: 1000,
      ease: 'Power2.easeInOut'
    });
  }
}

function createBeerProjectile(scene, projectileData) {
  try {
    if (projectiles[projectileData.id]) {
      projectiles[projectileData.id].destroy();
      delete projectiles[projectileData.id];
    }

    const texture = projectileData.type === 'bottle' ? 'bottle' : 'beerProjectile';
    const projectile = scene.physics.add.sprite(projectileData.x, projectileData.y, texture);
    
    projectile.setVelocity(projectileData.vx, projectileData.vy);
    projectile.setCollideWorldBounds(false);
    projectile.setBounce(0.3);
    projectile.setDrag(30);
    projectile.setDepth(6);
    projectile.id = projectileData.id;

    scene.tweens.add({
      targets: projectile,
      rotation: Math.PI * 4,
      duration: 2000,
      repeat: -1,
      ease: 'Linear'
    });

    wallSprites.forEach(wall => {
      scene.physics.add.collider(projectile, wall, () => {
        if (projectiles[projectile.id]) {
          scene.tweens.add({
            targets: projectiles[projectile.id],
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 200,
            onComplete: () => {
              if (projectiles[projectile.id]) {
                projectiles[projectile.id].destroy();
                delete projectiles[projectile.id];
              }
            }
          });
        }
      });
    });

    scene.time.delayedCall(5000, () => {
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
  if (!selfId || !players[selfId]) return;

  const deltaTime = Math.min(delta, 50);

  // Обработка ввода
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
      performShoot(time);
    }
  }

  // Обновление движения для своего игрока
  const me = players[selfId];
  if (me && me.sprite && me.data.alive) {
    const speed = me.data.activePowerUp === 'speed' ? 300 : 200;
    let vx = 0, vy = 0;

    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
      me.lastDirection = { x: vx / speed, y: vy / speed };
    }

    me.sprite.setVelocity(vx, vy);

    // Небольшой поворот кружки при движении
    if (vx !== 0 || vy !== 0) {
      const angle = Math.atan2(vy, vx) * (180 / Math.PI);
      game.scene.scenes[0].tweens.add({
        targets: me.sprite,
        rotation: angle * 0.01,
        duration: 300,
        ease: 'Power2'
      });
    }
  }

  // Отправка ввода на сервер
  if (time - lastInputTime >= 1000 / INPUT_SEND_RATE) {
    sendInputToServer(input);
    lastInputTime = time;
  }

  // Обновление всех игроков
  updateAllPlayers(deltaTime);
}

function performShoot(time) {
  const me = players[selfId];
  if (!me || !me.sprite || !me.data.alive) return;

  let shootVx = 0, shootVy = 0;
  
  if (cursors.left.isDown) shootVx -= 1;
  if (cursors.right.isDown) shootVx += 1;
  if (cursors.up.isDown) shootVy -= 1;
  if (cursors.down.isDown) shootVy += 1;

  if (shootVx === 0 && shootVy === 0) {
    shootVx = me.lastDirection.x;
    shootVy = me.lastDirection.y;
  }

  if (shootVx === 0 && shootVy === 0) {
    shootVx = 1;
  }

  const speed = 350;
  const len = Math.hypot(shootVx, shootVy);
  if (len > 0) {
    shootVx = (shootVx / len) * speed;
    shootVy = (shootVy / len) * speed;
  }

  lastShootTime = time;
  const localId = `proj_${selfId}_${Date.now()}_${Math.random()}`;

  const projectileData = {
    id: localId,
    x: me.sprite.x,
    y: me.sprite.y,
    vx: shootVx,
    vy: shootVy
  };

  createBeerProjectile(game.scene.scenes[0], projectileData);
  
  if (game.scene.scenes[0].sound.sounds.find(s => s.key === 'shoot')) {
    game.scene.scenes[0].sound.play('shoot');
  }

  socket.emit('shoot', {
    ...projectileData,
    localId: localId
  });
}

function sendInputToServer(input) {
  const me = players[selfId];
  if (!me || !me.sprite) return;

  if (input.action === 'swing') {
    const range = 100;
    let targetId = null;
    let bestDistance = range;

    Object.keys(players).forEach(id => {
      if (id === selfId) return;
      const p = players[id];
      if (p && p.sprite && p.data.alive) {
        const dx = p.sprite.x - me.sprite.x;
        const dy = p.sprite.y - me.sprite.y;
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          targetId = id;
        }
      }
    });

    if (targetId) {
      socket.emit('input', {
        ...input,
        action: 'swing',
        targetId,
        ax: me.sprite.x,
        ay: me.sprite.y
      });
    } else {
      socket.emit('input', input);
    }
  } else {
    socket.emit('input', input);
  }
}

function updateAllPlayers(deltaTime) {
  Object.keys(players).forEach(id => {
    const player = players[id];
    if (!player || !player.sprite) return;

    // Плавная интерполяция для других игроков
    if (id !== selfId && player.data.alive) {
      const dx = player.targetX - player.sprite.x;
      const dy = player.targetY - player.sprite.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 2) {
        player.sprite.x += dx * 0.15;
        player.sprite.y += dy * 0.15;
      }
    }

    // Обновление UI элементов
    updatePlayerUI(player);
    
    // Обновление эффектов
    updatePlayerEffects(player, id);
  });
}

function updatePlayerUI(player) {
  if (!player.sprite || !player.data) return;

  player.nameText.x = player.sprite.x;
  player.nameText.y = player.sprite.y - 45;

  player.hpBarBg.x = player.sprite.x;
  player.hpBarBg.y = player.sprite.y - 32;
  player.hpBar.x = player.sprite.x;
  player.hpBar.y = player.sprite.y - 32;

  const hpPercentage = Math.max(0, player.data.hp / 100);
  const hpWidth = hpPercentage * 50;
  player.hpBar.width = hpWidth;

  if (player.data.hp > 60) {
    player.hpBar.fillColor = 0x00ff00;
  } else if (player.data.hp > 30) {
    player.hpBar.fillColor = 0xffa500;
  } else {
    player.hpBar.fillColor = 0xff0000;
  }
}

function updatePlayerEffects(player, playerId) {
  if (!player.sprite || !player.data) return;

  // Проверка нахождения в кустах
  let inBush = false;
  for (const bush of bushSprites) {
    if (player.sprite.body && bush.body) {
      const dx = player.sprite.x - bush.x;
      const dy = player.sprite.y - bush.y;
      if (Math.hypot(dx, dy) < 35) {
        inBush = true;
        break;
      }
    }
  }

  // Обновление прозрачности
  if (!player.data.alive) {
    player.sprite.setAlpha(0.3);
    player.nameText.setAlpha(0.3);
    player.hpBar.setAlpha(0);
    player.hpBarBg.setAlpha(0);
  } else if (inBush) {
    if (playerId !== selfId) {
      player.sprite.setAlpha(0.4);
      player.nameText.setAlpha(0.4);
      player.hpBar.setAlpha(0.4);
      player.hpBarBg.setAlpha(0.4);
    } else {
      player.sprite.setAlpha(0.8);
      player.nameText.setAlpha(1);
      player.hpBar.setAlpha(1);
      player.hpBarBg.setAlpha(1);
    }
  } else {
    player.sprite.setAlpha(1);
    player.nameText.setAlpha(1);
    player.hpBar.setAlpha(1);
    player.hpBarBg.setAlpha(1);
  }

  // Обновление ауры от powerup
  if (player.data.activePowerUp) {
    const color = player.data.activePowerUp === 'speed' ? 0xFFFF00 : 0xFF0000;
    const pulseFactor = 0.3 + Math.sin(Date.now() / 200) * 0.2;
    
    if (!player.powerUpAura) {
      player.powerUpAura = game.scene.scenes[0].add.ellipse(
        player.sprite.x, 
        player.sprite.y, 
        50, 50, 
        color, 
        pulseFactor
      );
      player.powerUpAura.setDepth(player.sprite.depth - 1);
      player.powerUpAura.setStrokeStyle(2, color, 0.8);
    }
    
    player.powerUpAura.x = player.sprite.x;
    player.powerUpAura.y = player.sprite.y;
    player.powerUpAura.setAlpha(pulseFactor);
  } else if (player.powerUpAura) {
    player.powerUpAura.destroy();
    player.powerUpAura = null;
  }
}

// Инициализация игры
window.addEventListener('load', () => {
  console.log("Window loaded, creating Phaser game...");
  game = new Phaser.Game(config);
});

// Обработка изменения размера окна
window.addEventListener('resize', () => {
  if (game && game.scale) {
    game.scale.resize(window.innerWidth, window.innerHeight);
    
    // Пересчитываем масштаб для статичной камеры
    if (game.scene.scenes[0] && game.scene.scenes[0].cameras.main && worldSize) {
      setupStaticCamera(game.scene.scenes[0], worldSize);
    }
  }
});const socket = io();
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
const SHOOT_COOLDOWN = 300;
let lastInputTime = 0;
const INPUT_SEND_RATE = 30;
let walls = [];
let wallSprites = [];
let bushes = [];
let bushSprites = [];
let trees = [];
let treeSprites = [];
let powerUpSprites = {};
let hillZoneSprite;

// Мобильные элементы управления
let joystickOrigin = { x: 0, y: 0 };
let joystickActive = false;
let mobileInput = { left: false, right: false, up: false, down: false };
let isMobileDevice = false;

// Статичная камера
const CAMERA_SCALE = 1;
let worldSize = { width: 800, height: 600 };

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
  },
  render: {
    pixelArt: false,
    antialias: true
  }
};

function preload() {
  console.log("Loading textures...");
  
  this.load.on('loaderror', (file) => {
    console.warn('Failed to load:', file.src);
  });

  this.load.audio('shoot', 'assets/shoot.mp3');
  this.load.audio('hit', 'assets/hit.mp3');
  this.load.audio('death', 'assets/death.mp3');
  this.load.audio('shatter', 'assets/shatter.mp3');
}

function create() {
  console.log("Game scene created!");
  const scene = this;

  // Создаем все текстуры
  createBeerMugTexture(scene);
  createBeerProjectileTexture(scene);
  createWallTexture(scene);
  createBushTexture(scene);
  createTreeTexture(scene);
  createPowerUpTextures(scene);
  createBottleTexture(scene);

  // Определяем тип устройства
  isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                   window.innerWidth < 768 || 'ontouchstart' in window;

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

  // Настройка UI
  const joinBtn = document.getElementById('joinBtn');
  const nameInput = document.getElementById('name');

  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const name = nameInput ? nameInput.value.trim() || 'Player' : 'Player';
      console.log("Join button clicked! Name:", name);
      socket.emit('join', { name });
    });
  }

  if (nameInput) {
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinBtn.click();
      }
    });
  }

  // Обработчики сокетов
  socket.on('connect', () => {
    console.log("Connected to server!");
  });

  socket.on('disconnect', () => {
    console.log("Disconnected from server!");
    document.getElementById('join').style.display = 'block';
    if (nameInput) nameInput.placeholder = 'Переподключение...';
  });

  socket.on('joined', (data) => {
    console.log("Joined game with ID:", data.id);
    selfId = data.id;
    document.getElementById('join').style.display = 'none';

    if (data.worldSize) {
      worldSize = data.worldSize;
      scene.physics.world.setBounds(0, 0, worldSize.width, worldSize.height);
      
      // Настраиваем статичную камеру
      setupStaticCamera(scene, worldSize);
      
      // Создаем фон
      createWorldBackground(scene, worldSize);
    }

    // Создаем объекты мира
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
    alert(err.message || 'Ошибка подключения');
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
    if (p && p.sprite) {
      if (scene.sound.sounds.find(s => s.key === 'death')) {
        scene.sound.play('death');
      }
      
      scene.tweens.add({
        targets: p.sprite,
        alpha: 0.3,
        angle: 180,
        scaleX: 0.8,
        scaleY: 0.8,
        duration: 500,
        ease: 'Power2'
      });
    }
  });

  socket.on('respawned', () => {
    const me = players[selfId];
    if (me && me.sprite) {
      me.sprite.setAlpha(1);
      me.sprite.setAngle(0);
      me.sprite.setScale(1);
      
      scene.tweens.add({
        targets: me.sprite,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 200,
        yoyo: true,
        ease: 'Back.easeOut'
      });
    }
  });

  socket.on('beerHit', ({ attackerId, targetId, x, y }) => {
    if (scene.sound.sounds.find(s => s.key === 'hit')) {
      scene.sound.play('hit');
    }
    
    createSplashEffect(scene, x, y);
    
    const target = players[targetId];
    if (target && target.sprite) {
      scene.tweens.add({
        targets: target.sprite,
        x: target.sprite.x + Phaser.Math.Between(-8, 8),
        y: target.sprite.y + Phaser.Math.Between(-8, 8),
        duration: 100,
        yoyo: true,
        repeat: 2,
        ease: 'Power2'
      });
    }
  });

  socket.on('powerUpSpawned', (powerUp) => {
    createPowerUp(scene, powerUp);
  });

  socket.on('powerUpCollected', ({ powerUpId, playerId }) => {
    if (powerUpSprites[powerUpId]) {
      scene.tweens.add({
        targets: powerUpSprites[powerUpId],
        scaleX: 2,
        scaleY: 2,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          if (powerUpSprites[powerUpId]) {
            powerUpSprites[powerUpId].destroy();
            delete powerUpSprites[powerUpId];
          }
        }
      });
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

    createBeerProjectile(scene, projectile);
  });

  socket.on('projectileDestroyed', ({ id }) => {
    if (projectiles[id]) {
      scene.tweens.add({
        targets: projectiles[id],
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 150,
        ease: 'Power2',
        onComplete: () => {
          if (projectiles[id]) {
            projectiles[id].destroy();
            delete projectiles[id];
          }
        }
      });
    }
  });

  socket.on('projectileShattered', ({ id, x, y, type }) => {
    if (projectiles[id]) {
      projectiles[id].destroy();
      delete projectiles[id];
    }
    
    if (type === 'bottle') {
      createShatterEffect(scene, x, y);
      if (scene.sound.sounds.find(s => s.key === 'shatter')) {
        scene.sound.play('shatter');
      }
    }
  });

  socket.on('state', ({ players: statePlayers, leaderboard, hill }) => {
    statePlayers.forEach(p => {
      addOrUpdatePlayer(p, scene, p.id === selfId);
    });

    const activeIds = statePlayers.map(p => p.id);
    Object.keys(players).forEach(id => {
      if (!activeIds.includes(id)) {
        removePlayer(id);
      }
    });

    renderLeaderboard(leaderboard);
    updateKingOfTheHillUI(hill);
  });

  socket.on('hillMoved', (hillZone) => {
    createOrUpdateHillZone(scene, hillZone);
  });
}

function setupStaticCamera(scene, worldSize) {
  // Вычисляем масштаб для помещения всей карты на экран
  const scaleX = window.innerWidth / worldSize.width;
  const scaleY = window.innerHeight / worldSize.height;
  const scale = Math.min(scaleX, scaleY, 1.2); // Максимальный зум 1.2x
  
  console.log(`Setting up static camera: scale=${scale}, world=${worldSize.width}x${worldSize.height}, screen=${window.innerWidth}x${window.innerHeight}`);
  
  // Устанавливаем масштаб камеры
  scene.cameras.main.setZoom(scale);
  
  // Центрируем камеру на карте
  scene.cameras.main.centerOn(worldSize.width / 2, worldSize.height / 2);
  
  // Отключаем следование камеры
  scene.cameras.main.stopFollow();
}

function createWorldBackground(scene, worldSize) {
  const gridGraphics = scene.add.graphics();
  gridGraphics.fillStyle(0x1a1a2e, 1);
  gridGraphics.fillRect(0, 0, worldSize.width, worldSize.height);
  
  // Рисуем границы карты
  gridGraphics.lineStyle(3, 0x444444, 1);
  gridGraphics.strokeRect(0, 0, worldSize.width, worldSize.height);
  
  // Рисуем сетку
  gridGraphics.lineStyle(1, 0x333333, 0.3);
  const gridSize = 50;
  
  for (let x = 0; x <= worldSize.width; x += gridSize) {
    gridGraphics.moveTo(x, 0);
    gridGraphics.lineTo(x, worldSize.height);
  }
  
  for (let y = 0; y <= worldSize.height; y += gridSize) {
    gridGraphics.moveTo(0, y);
    gridGraphics.lineTo(worldSize.width, y);
  }
  
  gridGraphics.strokePath();
  gridGraphics.setDepth(-10);
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

  if (shootBtn) {
    shootBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      mobileShoot();
    });
  }

  if (swingBtn) {
    swingBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      mobileSwing();
    });
  }
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

  const threshold = maxDistance * 0.25;
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
  if (time - lastShootTime < SHOOT_COOLDOWN) return;

  const me = players[selfId];
  if (!me || !me.sprite || !me.data.alive) return;

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

  const speed = 350;
  const len = Math.hypot(shootVx, shootVy);
  if (len > 0) {
    shootVx = (shootVx / len) * speed;
    shootVy = (shootVy / len) * speed;
  }

  lastShootTime = time;
  const localId = `proj_${selfId}_${Date.now()}_${Math.random()}`;

  const projectileData = {
    id: localId,
    x: me.sprite.x,
    y: me.sprite.y,
    vx: shootVx,
    vy: shootVy
  };

  createBeerProjectile(game.scene.scenes[0], projectileData);
  
  if (game.scene.scenes[0].sound.sounds.find(s => s.key === 'shoot')) {
    game.scene.scenes[0].sound.play('shoot');
  }

  socket.emit('shoot', {
    ...projectileData,
    localId: localId
  });
}

function mobileSwing() {
  const me = players[selfId];
  if (!me || !me.sprite || !me.data.alive) return;

  const range = 100;
  let targetId = null;
  let bestDistance = range;

  Object.keys(players).forEach(id => {
    if (id === selfId) return;
    const p = players[id];
    if (p && p.sprite && p.data.alive) {
      const dx = p.sprite.x - me.sprite.x;
      const dy = p.sprite.y - me.sprite.y;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
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

function addOrUpdatePlayer(playerData, scene, isSelf) {
  const existingPlayer = players[playerData.id];

  if (!existingPlayer) {
    console.log("Creating new player:", playerData.name, "at", playerData.x, playerData.y);

    const sprite = scene.physics.add.sprite(playerData.x, playerData.y, 'beer');
    sprite.setCollideWorldBounds(true);
    sprite.setBounce(0.2);
    sprite.setDrag(150);
    sprite.body.setCircle(22);

    // Создаем UI элементы
    const nameText = scene.add.text(playerData.x, playerData.y - 45, playerData.name, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setDepth(5).setOrigin(0.5);

    const hpBarBg = scene.add.rectangle(playerData.x, playerData.y - 32, 50, 6, 0x333333).setDepth(4);
    const hpBar = scene.add.rectangle(playerData.x, playerData.y - 32, 50, 6, 0x00ff00).setDepth(5);

    players[playerData.id] = {
      sprite,
      nameText,
      hpBar,
      hpBarBg,
      data: playerData,
      lastDirection: playerData.lastDirection || { x: 1, y: 0 },
      targetX: playerData.x,
      targetY: playerData.y,
      lastUpdateTime: Date.now(),
      powerUpAura: null
    };

    // Добавляем коллизии с другими игроками
    Object.keys(players).forEach(id => {
      if (id !== playerData.id && players[id] && players[id].sprite) {
        scene.physics.add.collider(sprite, players[id].sprite, handlePlayerCollision);
      }
    });

    // Добавляем коллизии со стенами
    wallSprites.forEach(wall => {
      scene.physics.add.collider(sprite, wall);
    });

  } else {
    // Обновляем существующего игрока
    const player = players[playerData.id];
    player.data = playerData;
    player.lastDirection = playerData.lastDirection || player.lastDirection;
    
    if (!isSelf) {
      // Для других игроков используем плавную интерполяцию
      player.targetX = playerData.x;
      player.targetY = playerData.y;
    } else {
      // Для себя сразу устанавливаем позицию (предотвращает дерганье)
      player.sprite.x = playerData.x;
      player.sprite.y = playerData.y;
    }
    
    player.lastUpdateTime = Date.now();
  }
}

function handlePlayerCollision(sprite1, sprite2) {
  const angle = Phaser.Math.Angle.Between(sprite1.x, sprite1.y, sprite2.x, sprite2.y);
  const force = 40;

  sprite1.setVelocity(
    Math.cos(angle + Math.PI) * force,
    Math.sin(angle + Math.PI) * force
  );
  sprite2.setVelocity(
    Math.cos(angle) * force,
    Math.sin(angle) * force
  );

  sprite1.setAngularVelocity(Phaser.Math.Between(-150, 150));
  sprite2.setAngularVelocity(Phaser.Math.Between(-150, 150));

  setTimeout(() => {
    if (sprite1 && sprite1.active) sprite1.setAngularVelocity(0);
    if (sprite2 && sprite2.active) sprite2.setAngularVelocity(0);
  }, 400);
}

function removePlayer(id) {
  const player = players[id];
  if (!player) return;

  if (player.sprite) player.sprite.destroy();
  if (player.nameText) player.nameText.destroy();
  if (player.hpBar) player.hpBar.destroy();
  if (player.hpBarBg) player.hpBarBg.destroy();
  if (player.powerUpAura) player.powerUpAura.destroy();

  delete players[id];
}

function createSplashEffect(scene, x, y) {
  const splash = scene.add.circle(x, y, 15, 0xFFD700, 0.8);
  splash.setDepth(10);
  
  scene.tweens.add({
    targets: splash,
    scaleX: 3,
    scaleY: 3,
    alpha: 0,
    duration: 600,
    ease: 'Power2.easeOut',
    onComplete: () => splash.destroy()
  });

  for (let i = 0; i < 5; i++) {
    const particle = scene.add.circle(
      x + Phaser.Math.Between(-10, 10),
      y + Phaser.Math.Between(-10, 10),
      Phaser.Math.Between(2, 5),
      0xFFA500,
      0.7
    );
    particle.setDepth(9);
    
    scene.tweens.add({
      targets: particle,
      x: particle.x + Phaser.Math.Between(-20, 20),
      y: particle.y + Phaser.Math.Between(-20, 20),
      alpha: 0,
      duration: Phaser.Math.Between(300, 600),
      ease: 'Power2.easeOut',
      onComplete: () => particle.destroy()
    });
  }
}

function createShatterEffect(scene, x, y) {
  for (let i = 0; i < 8; i++) {
    const shard = scene.add.rectangle(
      x + Phaser.Math.Between(-5, 5),
      y + Phaser.Math.Between(-5, 5),
      Phaser.Math.Between(3, 8),
      Phaser.Math.Between(3, 8),
      0x8B4513,
      0.8
    );
    shard.setDepth(8);
    
    const angle = (Math.PI * 2 / 8) * i;
    const distance = Phaser.Math.Between(30, 60);
    
    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      rotation: Phaser.Math.Between(0, Math.PI * 2),
      alpha: 0,
      duration: Phaser.Math.Between(400, 800),
      ease: 'Power2.easeOut',
      onComplete: () => shard.destroy()
    });
  }
}

function renderLeaderboard(leaderboard) {
  const element = document.getElementById('leaderboard-content');
  if (!element || !leaderboard) return;

  element.innerHTML = `
    <h3 style="margin:0 0 8px 0; text-align:center; color: #FFD700; font-size: 14px;">🏆 Лидеры</h3>
    <div style="display: grid; grid-template-columns: 20px 1fr auto auto; gap: 3px; align-items: center; font-size: 11px;">
      <span style="font-weight: bold; color: #ccc;">#</span>
      <span style="font-weight: bold; color: #ccc;">Имя</span>
      <span style="font-weight: bold; color: #ccc; text-align: right;">Очки</span>
      <span style="font-weight: bold; color: #ccc; text-align: right;">Убийств</span>
      ${leaderboard.map((player, index) => `
        <span style="color: ${getRankColor(index)}; font-weight: bold;">${index + 1}.</span>
        <span style="color: ${getRankColor(index)}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(player.name)}</span>
        <span style="text-align: right; color: #fff;">${Math.round(player.score)}</span>
        <span style="text-align: right; color: #fff;">${player.kills}</span>
      `).join('')}
    </div>
  `;
}

function updateKingOfTheHillUI(hillData) {
  if (!hillZoneSprite || !hillData) return;

  let color = 0xFFD700;
  let alpha = 0.2;

  if (hillData.contested) {
    color = 0xFF4500;
    alpha = 0.4;
  } else if (hillData.controller) {
    color = 0x00FF00;
    alpha = 0.3;
  }

  hillZoneSprite.setFillStyle(color, alpha);

  const uiElement = document.getElementById('king-of-the-hill');
  if (uiElement) {
    const king = hillData.king ? players[hillData.king] : null;
    if (king && king.data) {
      const time = Math.floor(king.data.hillTime || 0);
      uiElement.innerHTML = `
        <h3 style="margin:0; color: #FFD700; font-size: 14px;">👑 Король холма</h3>
        <div style="font-size: 12px;">${escapeHtml(king.data.name)}</div>
        <div style="font-size: 11px; color: #ccc;">⏱️ ${time}с</div>
      `;
      uiElement.style.display = 'block';
    } else {
      uiElement.style.display = 'none';
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getRankColor(index) {
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#FFFFFF'];
  return colors[index] || '#FFFFFF';
}