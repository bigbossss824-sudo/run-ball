import * as THREE from 'three';

const canvas = document.querySelector('#game');
const menu = document.querySelector('#menu');
const gameOverScreen = document.querySelector('#game-over');
const hud = document.querySelector('#hud');
const controlsHint = document.querySelector('#controls-hint');
const scoreEl = document.querySelector('#score');
const timeEl = document.querySelector('#time');
const boostEl = document.querySelector('#boost');
const recordEl = document.querySelector('#record');
const finalScoreEl = document.querySelector('#final-score');
const leaderboardEl = document.querySelector('#leaderboard');

const TRACK_WIDTH = 15;
const TRACK_LENGTH = 760;
const TRACK_AHEAD = 330;
const TRACK_CENTER_OFFSET = (TRACK_AHEAD - (TRACK_LENGTH - TRACK_AHEAD)) / 2;
const TRACK_TOP_Y = 0.5;
const SIDE_PLATFORM_HALF_WIDTH = 14;
const SIDE_PLATFORM_Y = 0;
const SIDE_PLATFORM_TOP_Y = 0.675;
const BALL_RADIUS = 1;
const BALL_GROUND_Y = TRACK_TOP_Y + BALL_RADIUS;
const OBSTACLE_SIZE = 2.05;
const OBSTACLE_CENTER_Y = TRACK_TOP_Y + (OBSTACLE_SIZE / 2);
const SECOND_OBSTACLE_WIDTH_SCALE = 1.15;
const SECOND_OBSTACLE_HEIGHT_SCALE = 3.2;
const SECOND_OBSTACLE_DEPTH_SCALE = 1.15;
const RAMP_HALF_WIDTH = 2.1;
const RAMP_CONTACT_HALF_WIDTH = RAMP_HALF_WIDTH + BALL_RADIUS * 0.75;
const OBSTACLE_HALF_WIDTH = OBSTACLE_SIZE / 2;
const MIN_RAMP_OBSTACLE_Z = 30;
const MIN_OBSTACLE_Z = 24;
const MIN_OBSTACLE_X = 3.7;
const GRAVITY = -35;
const SIDE_ACCELERATION = 32;
const SIDE_MAX_SPEED = 8.5;
const SIDE_FRICTION = 14;
const MAX_JUMP_LAUNCH = 16;
const MAX_PLAYER_HEIGHT = 14;
const FALL_GAME_OVER_Y = -4;
const DOUBLE_SCORE_SECONDS = 5;
const THEME_SCORE_INTERVAL = 250;
const LOG_OBSTACLE_START_TIME = 60;
const GAME_OVER_DELAY_SECONDS = 1.15;

const difficulties = {
  Easy: { startSpeed: 16, obstacleChance: 0.22, rampFrequency: 4 },
  Medium: { startSpeed: 22, obstacleChance: 0.43, rampFrequency: 6 },
  Hard: { startSpeed: 30, obstacleChance: 0.55, rampFrequency: 8 },
};

const themes = {
  Easy: [
    ['#87ceeb', '#4f5f66', '#3a474d', '#4ade80', '#ff7a00', '#f43f5e'],
    ['#bee1b4', '#6a7470', '#405148', '#9ccc65', '#ff7043', '#26a69a'],
    ['#f89d5c', '#566068', '#4a3f42', '#ffcc66', '#00b4d8', '#7c3aed'],
  ],
  Medium: [
    ['#f89d5c', '#566068', '#4a3f42', '#ffcc66', '#00b4d8', '#7c3aed'],
    ['#87ceeb', '#4f5f66', '#3a474d', '#4ade80', '#ff7a00', '#f43f5e'],
    ['#2a3456', '#5f6f78', '#25313d', '#70e1f5', '#fff176', '#ff5c8a'],
  ],
  Hard: [
    ['#2a3456', '#5f6f78', '#25313d', '#70e1f5', '#fff176', '#ff5c8a'],
    ['#f89d5c', '#566068', '#4a3f42', '#ffcc66', '#00b4d8', '#7c3aed'],
    ['#bee1b4', '#6a7470', '#405148', '#9ccc65', '#ff7043', '#26a69a'],
  ],
};

const skinRequirements = {
  velvet: 0,
  matrix: 0,
  alabaster: 750,
  bronze: 1500,
  silver: 2000,
  gold: 2500,
};

const skinColors = {
  velvet: 0xd32828,
  matrix: 0x00fff0,
  alabaster: 0xf4f1e8,
  bronze: 0xb06b35,
  silver: 0xaeb8c0,
  gold: 0xe0a62a,
};

const skinStripeColors = {
  velvet: 0x6f1f23,
  alabaster: 0xcac5bc,
  bronze: 0x7e4a25,
  silver: 0x808b94,
  gold: 0xa8771f,
};

let selectedDifficulty = 'Medium';
let selectedSkin = 'velvet';
let running = false;
let gameOver = false;
let deathPending = false;
let deathTimer = 0;
let gameSpeed = 22;
let gameTime = 0;
let score = 0;
let lastZ = 0;
let yVelocity = 0;
let xVelocity = 0;
let wasOnRamp = false;
let falling = false;
let fallSide = 0;
let activeThemeIndex = -1;
let doubleScoreUntil = 0;
let userStartedAudio = false;

const keys = new Set();
const touchControls = {
  left: false,
  right: false,
};
const obstacles = [];
const ramps = [];
const pickups = [];
const buildings = [];
const clouds = [];
const turns = [];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);
camera.position.set(0, 5, -15);

const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3f44, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-10, 18, -8);
sun.castShadow = true;
scene.add(sun);

const track = makeBox(TRACK_WIDTH, 1, TRACK_LENGTH, 0x4f5f66);
track.position.set(0, 0, TRACK_CENTER_OFFSET);
scene.add(track);

const leftPlatform = makeBox(SIDE_PLATFORM_HALF_WIDTH * 2, 1.35, TRACK_LENGTH, 0x3a474d);
const rightPlatform = makeBox(SIDE_PLATFORM_HALF_WIDTH * 2, 1.35, TRACK_LENGTH, 0x3a474d);
const leftGap = makeBox(12, 0.16, TRACK_LENGTH, 0x000000);
const rightGap = makeBox(12, 0.16, TRACK_LENGTH, 0x000000);
scene.add(leftPlatform, rightPlatform, leftGap, rightGap);

const ballMaterial = new THREE.MeshStandardMaterial({
  color: skinColors.velvet,
  roughness: 0.42,
  metalness: 0.08,
});
const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), ballMaterial);
ball.position.set(0, BALL_GROUND_Y, 0);
ball.castShadow = true;
scene.add(ball);

const skinPattern = new THREE.Group();
ball.add(skinPattern);
const velvetTexture = makeVelvetTexture();
const menuMusic = new Audio('./menu_loop.wav');
const gameMusic = new Audio('./upbeat_loop.wav');
let gameOverMusic = null;
menuMusic.loop = true;
gameMusic.loop = true;
menuMusic.volume = 0.28;
gameMusic.volume = 0.38;

function makeBox(w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.28 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeVelvetTexture() {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 512;
  textureCanvas.height = 256;
  const ctx = textureCanvas.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 512, 256);
  base.addColorStop(0, '#701d21');
  base.addColorStop(0.42, '#d3262b');
  base.addColorStop(0.75, '#ff1519');
  base.addColorStop(1, '#8d171b');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 256);

  const smoke = ctx.createRadialGradient(125, 108, 16, 125, 108, 190);
  smoke.addColorStop(0, 'rgba(70, 82, 87, 0.64)');
  smoke.addColorStop(0.42, 'rgba(70, 82, 87, 0.46)');
  smoke.addColorStop(1, 'rgba(70, 82, 87, 0)');
  ctx.fillStyle = smoke;
  ctx.fillRect(0, 0, 512, 256);

  const lowerShadow = ctx.createRadialGradient(170, 226, 14, 170, 226, 150);
  lowerShadow.addColorStop(0, 'rgba(22, 30, 31, 0.74)');
  lowerShadow.addColorStop(0.55, 'rgba(22, 30, 31, 0.42)');
  lowerShadow.addColorStop(1, 'rgba(22, 30, 31, 0)');
  ctx.fillStyle = lowerShadow;
  ctx.fillRect(0, 0, 512, 256);

  const highlight = ctx.createRadialGradient(350, 72, 4, 350, 72, 60);
  highlight.addColorStop(0, 'rgba(255, 232, 222, 0.78)');
  highlight.addColorStop(0.2, 'rgba(255, 210, 202, 0.32)');
  highlight.addColorStop(1, 'rgba(255, 210, 202, 0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, 512, 256);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function playTrack(track) {
  [menuMusic, gameMusic, gameOverMusic].filter(Boolean).forEach((audio) => {
    if (audio !== track) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
  track.play().catch(() => {});
}

function playMenuMusic() {
  stopGameOverMusic();
  playTrack(menuMusic);
}

function playGameOverMusic() {
  stopGameOverMusic();
  gameOverMusic = new Audio('./game_over_loop.wav');
  gameOverMusic.loop = false;
  gameOverMusic.volume = 0.65;
  playTrack(gameOverMusic);
}

function stopGameOverMusic() {
  if (!gameOverMusic) return;
  gameOverMusic.pause();
  gameOverMusic.currentTime = 0;
  gameOverMusic.volume = 0;
  gameOverMusic = null;
}

function unlockAudio() {
  if (userStartedAudio) return;
  userStartedAudio = true;
  if (!running && !gameOver && !deathPending) playMenuMusic();
}

function stopTracks() {
  [menuMusic, gameMusic, gameOverMusic].filter(Boolean).forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  gameOverMusic = null;
}

function makePickup() {
  const pickup = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffd34d,
      emissive: 0x9a6500,
      roughness: 0.28,
      metalness: 0.6,
    }),
  );
  pickup.castShadow = true;
  pickup.visible = false;
  pickup.userData.baseY = BALL_GROUND_Y + 3.1;
  pickup.userData.spinSpeed = rand(1.4, 2.5);
  scene.add(pickup);
  pickups.push(pickup);
  return pickup;
}

function placeDoubleScorePickup(x, z) {
  if (Math.random() > 0.28) return;
  let pickup = pickups.find((item) => !item.visible || item.position.z < ball.position.z - 25);
  if (!pickup) pickup = makePickup();
  pickup.position.set(x, BALL_GROUND_Y + 3.1, z + 10);
  pickup.userData.baseY = BALL_GROUND_Y + 3.1;
  pickup.visible = true;
}

function clearSkinPattern() {
  while (skinPattern.children.length) {
    const child = skinPattern.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
}

function addSkinRing(color, radius, tube, rotation) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, 72),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.24,
      metalness: ['bronze', 'silver', 'gold'].includes(selectedSkin) ? 0.72 : 0.12,
    }),
  );
  ring.rotation.set(rotation[0], rotation[1], rotation[2]);
  skinPattern.add(ring);
}

function addRollingStripes(color) {
  addSkinRing(color, 0.99, 0.026, [Math.PI / 2, 0, 0]);
  addSkinRing(color, 0.72, 0.018, [0, Math.PI / 2, 0]);
  addSkinRing(color, 0.88, 0.014, [Math.PI / 4, Math.PI / 2, 0]);
}

function addVelvetShadowBand() {
  const band = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 48, 16, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.28),
    new THREE.MeshBasicMaterial({
      color: skinStripeColors.velvet,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  band.rotation.set(-0.28, 0.12, -0.08);
  skinPattern.add(band);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function courseCenterAt(z) {
  let center = 0;
  for (const turn of turns) {
    if (z <= turn.start) continue;
    if (z >= turn.end) center += turn.amount;
    else center += turn.amount * smoothstep((z - turn.start) / (turn.end - turn.start));
  }
  return center;
}

function visibleTrackCenter() {
  return track.position.x;
}

function clampToTrackAt(x, z, halfWidth, margin = 0.25) {
  const center = courseCenterAt(z);
  const limit = (TRACK_WIDTH / 2) - halfWidth - margin;
  return center + THREE.MathUtils.clamp(x - center, -limit, limit);
}

function clampToVisibleTrack(x, halfWidth, margin = 0.25) {
  const center = visibleTrackCenter();
  const limit = (TRACK_WIDTH / 2) - halfWidth - margin;
  return center + THREE.MathUtils.clamp(x - center, -limit, limit);
}

function availableMoveRange(x, z, halfWidth) {
  const center = visibleTrackCenter();
  return Math.max(0, (TRACK_WIDTH / 2) - halfWidth - 0.35 - Math.abs(x - center));
}

function currentTheme() {
  const list = themes[selectedDifficulty];
  return list[Math.max(0, activeThemeIndex) % list.length];
}

function applyThemeForScore(nextScore) {
  const nextIndex = Math.floor(nextScore / THEME_SCORE_INTERVAL);
  if (nextIndex === activeThemeIndex) return;
  activeThemeIndex = nextIndex;
  const [sky, trackColor, platformColor, rampColor, obstacleColor, logColor] = currentTheme();
  scene.background = new THREE.Color(sky);
  track.material.color.set(trackColor);
  leftPlatform.material.color.set(platformColor);
  rightPlatform.material.color.set(platformColor);
  ramps.forEach((ramp) => ramp.material.color.set(rampColor));
  obstacles.forEach((obstacle) => obstacle.material.color.set(obstacle.userData.log ? logColor : obstacleColor));
}

function generateTurns() {
  turns.length = 0;
  let currentZ = 170;
  let offset = 0;
  for (let i = 0; i < 8; i += 1) {
    currentZ += rand(160, 240);
    let amount = (Math.random() < 0.5 ? -1 : 1) * rand(1.5, 3.25);
    if (Math.abs(offset + amount) > 5) amount *= -1;
    turns.push({ start: currentZ, end: currentZ + rand(110, 170), amount });
    offset += amount;
  }
}

function generateCourse() {
  clearObjects([...obstacles, ...ramps, ...buildings, ...clouds, ...pickups]);
  obstacles.length = 0;
  ramps.length = 0;
  buildings.length = 0;
  clouds.length = 0;
  pickups.length = 0;
  generateTurns();

  const difficulty = difficulties[selectedDifficulty];
  let z = 50;
  for (let i = 0; i < 16; i += 1) {
    z += rand(25, 45);
    if (i % difficulty.rampFrequency === 0) {
      let attempts = 0;
      while (!spaceAvailableForRamp(z) && attempts < 12) {
        z += rand(18, 32);
        attempts += 1;
      }
      const ramp = makeBox(RAMP_HALF_WIDTH * 2, 1, 16, currentTheme()[3]);
      const rampX = clampToVisibleTrack(visibleTrackCenter() + rand(-2, 2), RAMP_HALF_WIDTH, 0.2);
      ramp.position.set(rampX, 0.8, z);
      ramp.rotation.x = THREE.MathUtils.degToRad(-10);
      scene.add(ramp);
      ramps.push(ramp);
      placeDoubleScorePickup(ramp.position.x, ramp.position.z);
    } else if (Math.random() < difficulty.obstacleChance || i < 3) {
      let attempts = 0;
      while (!spaceAvailableForObstacle(z) && attempts < 12) {
        z += rand(18, 32);
        attempts += 1;
      }
      const obstacle = makeBox(OBSTACLE_SIZE, OBSTACLE_SIZE, OBSTACLE_SIZE, currentTheme()[4]);
      obstacle.position.set(safeX(z), OBSTACLE_CENTER_Y, z);
      obstacle.userData.baseX = obstacle.position.x;
      obstacle.userData.moving = Math.random() < 0.35;
      obstacle.userData.range = rand(0.45, Math.max(0.55, Math.min(2.6, availableMoveRange(obstacle.position.x, z, OBSTACLE_HALF_WIDTH))));
      obstacle.userData.speed = rand(1.4, 2.4);
      obstacle.userData.phase = rand(0, Math.PI * 2);
      scene.add(obstacle);
      obstacles.push(obstacle);
    }
  }

  for (let i = 0; i < 34; i += 1) {
    makeBuilding(i % 2 ? -1 : 1, rand(35, 520));
  }
  for (let i = 0; i < 14; i += 1) {
    makeCloud(rand(70, 700));
  }
}

function safeX(z) {
  for (let i = 0; i < 12; i += 1) {
    const candidate = clampToVisibleTrack(visibleTrackCenter() + rand(-4.4, 4.4), OBSTACLE_HALF_WIDTH, 0.25);
    if (!overlapsRampZone(candidate, z) && !overlapsObstacleZone(candidate, z)) return candidate;
  }
  return visibleTrackCenter();
}

function overlapsRampZone(x, z, xBuffer = 2.8, zBuffer = 18) {
  return ramps.some((ramp) => Math.abs(ramp.position.z - z) < zBuffer && Math.abs(ramp.position.x - x) < xBuffer);
}

function overlapsObstacleZone(x, z, xBuffer = MIN_OBSTACLE_X, zBuffer = MIN_OBSTACLE_Z) {
  return obstacles.some((obstacle) => Math.abs(obstacle.position.z - z) < zBuffer && Math.abs(obstacle.position.x - x) < xBuffer);
}

function spaceAvailableForObstacle(z) {
  return !ramps.some((ramp) => Math.abs(ramp.position.z - z) < MIN_RAMP_OBSTACLE_Z)
    && !obstacles.some((obstacle) => Math.abs(obstacle.position.z - z) < MIN_OBSTACLE_Z);
}

function spaceAvailableForRamp(z) {
  return !obstacles.some((obstacle) => Math.abs(obstacle.position.z - z) < MIN_RAMP_OBSTACLE_Z)
    && !ramps.some((ramp) => Math.abs(ramp.position.z - z) < MIN_RAMP_OBSTACLE_Z);
}

function clearObjects(objects) {
  objects.forEach((object) => {
    scene.remove(object);
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
  });
}

function makeBuilding(side, z) {
  const [sky, trackColor, platformColor] = currentTheme();
  const height = rand(8, 18);
  const width = rand(4, 7);
  const depth = rand(7, 13);
  const group = new THREE.Group();
  group.position.set(side * rand(23, 36), SIDE_PLATFORM_TOP_Y, z);
  group.rotation.x = THREE.MathUtils.degToRad(-4.5);
  group.rotation.z = THREE.MathUtils.degToRad(side * 1.2);

  const body = makeBox(width, height, depth, new THREE.Color(platformColor).offsetHSL(0, 0, rand(-0.08, 0.12)));
  body.position.y = height / 2;
  group.add(body);

  const windowMat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xb3e5fc : 0xfff59d });
  for (let row = 0; row < Math.min(5, Math.floor(height / 3)); row += 1) {
    for (let col = 0; col < Math.min(4, Math.floor(depth / 2.4)); col += 1) {
      if (Math.random() < 0.3) continue;
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.75), windowMat);
      win.position.set(-side * (width / 2 + 0.05), 1.5 + row * 2.6, -depth / 2 + 1.2 + col * 2.1);
      group.add(win);
    }
  }

  scene.add(group);
  buildings.push(group);
}

function makeCloud(z) {
  const group = new THREE.Group();
  group.position.set(rand(-45, 45), rand(18, 30), z);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [[0, 0, 0, 5.5], [3, 0.2, 0.2, 4], [-3, 0.1, -0.1, 3.8]].forEach(([x, y, zz, s]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat);
    puff.position.set(x, y, zz);
    puff.scale.set(s, s * 0.35, s * 0.42);
    group.add(puff);
  });
  scene.add(group);
  clouds.push(group);
}

function resetGame() {
  userStartedAudio = true;
  playTrack(gameMusic);
  running = true;
  gameOver = false;
  deathPending = false;
  deathTimer = 0;
  falling = false;
  fallSide = 0;
  gameTime = 0;
  score = 0;
  lastZ = 0;
  yVelocity = 0;
  xVelocity = 0;
  wasOnRamp = false;
  doubleScoreUntil = 0;
  activeThemeIndex = -1;
  gameSpeed = difficulties[selectedDifficulty].startSpeed;
  ball.position.set(0, BALL_GROUND_Y, 0);
  ball.rotation.set(0, 0, 0);
  applySkin();
  applyThemeForScore(0);
  generateCourse();
  menu.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  hud.style.display = 'flex';
  controlsHint.style.display = 'grid';
}

function applySkin() {
  clearSkinPattern();
  const color = skinColors[selectedSkin] ?? skinColors.velvet;
  ballMaterial.map = null;
  ballMaterial.color.setHex(color);
  if (selectedSkin === 'matrix') {
    ballMaterial.color.setHex(0x101820);
    ballMaterial.emissive.setHex(0x002b2b);
    ballMaterial.metalness = 0.2;
    ballMaterial.roughness = 0.35;
    addSkinRing(0x00fff0, 1.01, 0.012, [Math.PI / 2, 0, 0]);
    addSkinRing(0xffff66, 0.78, 0.01, [Math.PI / 2, 0, 0]);
    addSkinRing(0x00fff0, 0.58, 0.01, [0, Math.PI / 2, 0]);
    addSkinRing(0xb45cff, 0.9, 0.012, [Math.PI / 4, Math.PI / 2, 0]);
  } else {
    ballMaterial.emissive.setHex(0x000000);
    ballMaterial.metalness = ['bronze', 'silver', 'gold'].includes(selectedSkin) ? 0.78 : 0.08;
    ballMaterial.roughness = ['bronze', 'silver', 'gold'].includes(selectedSkin) ? 0.18 : 0.36;
    if (selectedSkin === 'velvet') {
      ballMaterial.color.setHex(0xffffff);
      ballMaterial.map = velvetTexture;
      ballMaterial.metalness = 0.12;
      ballMaterial.roughness = 0.46;
    }
    if (['alabaster', 'bronze', 'silver', 'gold'].includes(selectedSkin)) {
      addRollingStripes(skinStripeColors[selectedSkin]);
    }
  }
  ballMaterial.needsUpdate = true;
}

function hardRecord() {
  const boards = loadBoards();
  return boards.Hard?.[0] ?? 0;
}

function loadBoards() {
  return JSON.parse(localStorage.getItem('runBallBoards') || '{"Easy":[],"Medium":[],"Hard":[]}');
}

function saveScore(finalScore) {
  const boards = loadBoards();
  boards[selectedDifficulty] = [...(boards[selectedDifficulty] || []), finalScore].sort((a, b) => b - a).slice(0, 10);
  localStorage.setItem('runBallBoards', JSON.stringify(boards));
  return boards[selectedDifficulty];
}

function updateMenu() {
  recordEl.textContent = `Hard Record: ${hardRecord()}`;
  document.querySelectorAll('[data-difficulty]').forEach((button) => {
    button.classList.toggle('active', button.dataset.difficulty === selectedDifficulty);
  });
  document.querySelectorAll('[data-skin]').forEach((button) => {
    const requirement = skinRequirements[button.dataset.skin] ?? 0;
    const unlocked = hardRecord() >= requirement;
    button.classList.toggle('locked', !unlocked);
    button.classList.toggle('active', button.dataset.skin === selectedSkin);
    if (unlocked) {
      delete button.dataset.lockLabel;
    } else {
      button.dataset.lockLabel = `${requirement} Hard score`;
    }
  });
}

function endGame() {
  if (gameOver || deathPending) return;
  deathPending = true;
  deathTimer = GAME_OVER_DELAY_SECONDS;
  running = false;
  gameMusic.pause();
}

function showGameOver() {
  if (gameOver) return;
  gameOver = true;
  deathPending = false;
  stopTracks();
  playGameOverMusic();
  const finalScore = Math.floor(score);
  const scores = saveScore(finalScore);
  finalScoreEl.textContent = `Your Score: ${finalScore}`;
  leaderboardEl.textContent = `${selectedDifficulty} Top 10\n${scores.map((value, index) => `${index + 1}. ${value}`).join('\n')}`;
  gameOverScreen.classList.remove('hidden');
  hud.style.display = 'none';
  controlsHint.style.display = 'none';
}

function update(dt) {
  if (deathPending) {
    deathTimer -= dt;
    ball.rotation.x += gameSpeed * 0.12 * dt;
    if (deathTimer <= 0) showGameOver();
    return;
  }
  if (!running) return;
  gameTime += dt;
  gameSpeed += 0.65 * dt;
  const previousZ = ball.position.z;
  ball.position.z += gameSpeed * dt;
  ball.rotation.x += gameSpeed * 0.35 * dt;

  if (!falling) {
    let direction = 0;
    if (keys.has('a') || keys.has('arrowleft') || touchControls.left) direction += 1;
    if (keys.has('d') || keys.has('arrowright') || touchControls.right) direction -= 1;
    if (direction !== 0) {
      xVelocity += direction * SIDE_ACCELERATION * dt;
      xVelocity = THREE.MathUtils.clamp(xVelocity, -SIDE_MAX_SPEED, SIDE_MAX_SPEED);
    } else {
      const friction = SIDE_FRICTION * dt;
      if (Math.abs(xVelocity) <= friction) xVelocity = 0;
      else xVelocity -= Math.sign(xVelocity) * friction;
    }
    ball.position.x += xVelocity * dt;
  }

  const multiplier = gameTime < doubleScoreUntil ? 2 : 1;
  score += (Math.max(0, ball.position.z - lastZ) / 5) * multiplier;
  lastZ = ball.position.z;
  const currentScore = Math.floor(score);
  scoreEl.textContent = `Score: ${currentScore}`;
  timeEl.textContent = `Time: ${Math.floor(gameTime)}s`;
  boostEl.textContent = multiplier === 2 ? `x2 Score: ${(doubleScoreUntil - gameTime).toFixed(1)}s` : '';
  applyThemeForScore(currentScore);

  const roadZ = ball.position.z + TRACK_CENTER_OFFSET;
  const roadCenter = courseCenterAt(ball.position.z + TRACK_AHEAD);
  track.position.set(roadCenter, 0, roadZ);
  leftPlatform.position.set(roadCenter - 28.5, SIDE_PLATFORM_Y, roadZ);
  rightPlatform.position.set(roadCenter + 28.5, SIDE_PLATFORM_Y, roadZ);
  leftGap.position.set(roadCenter - 13, -0.2, roadZ);
  rightGap.position.set(roadCenter + 13, -0.2, roadZ);

  if (!falling && Math.abs(ball.position.x - visibleTrackCenter()) > TRACK_WIDTH / 2 - 0.15) {
    falling = true;
    fallSide = Math.sign(ball.position.x - visibleTrackCenter()) || 1;
    ball.position.x = visibleTrackCenter() + fallSide * ((TRACK_WIDTH / 2) + BALL_RADIUS * 0.45);
    yVelocity = Math.min(yVelocity, -8);
  }

  yVelocity += GRAVITY * dt;
  ball.position.y += yVelocity * dt;

  if (falling) {
    ball.position.x += fallSide * 5.5 * dt;
    if (ball.position.y < FALL_GAME_OVER_Y) endGame();
  } else {
    let ground = BALL_GROUND_Y;
    let onRamp = false;
    for (const ramp of ramps) {
      const nearZ = ball.position.z >= ramp.position.z - 8 && ball.position.z <= ramp.position.z + 8;
      const nearX = Math.abs(ball.position.x - ramp.position.x) <= RAMP_CONTACT_HALF_WIDTH;
      if (nearZ && nearX) {
        const progress = (ball.position.z - (ramp.position.z - 8)) / 16;
        ground = BALL_GROUND_Y + progress * 2.78;
        onRamp = true;
      }
    }
    if (ball.position.y <= ground) {
      ball.position.y = ground;
      if (yVelocity < 0) yVelocity = 0;
    }
    if (wasOnRamp && !onRamp) {
      yVelocity = Math.min(gameSpeed * 0.22, MAX_JUMP_LAUNCH);
    }
    if (ball.position.y > MAX_PLAYER_HEIGHT) {
      ball.position.y = MAX_PLAYER_HEIGHT;
      if (yVelocity > 0) yVelocity *= -0.15;
    }
    wasOnRamp = onRamp;
  }

  updatePickups();
  recycleWorld();
  checkObstacleHits();

  camera.position.z = ball.position.z - 15;
  camera.position.x += (visibleTrackCenter() + (ball.position.x - visibleTrackCenter()) * 0.5 - camera.position.x) * Math.min(1, dt * 6);
  camera.position.y += (ball.position.y + 4 - camera.position.y) * Math.min(1, dt * 10);
  camera.lookAt(ball.position.x, ball.position.y + 0.2, ball.position.z + 10);
}

function updatePickups() {
  for (const pickup of pickups) {
    if (!pickup.visible) continue;
    pickup.rotation.y += pickup.userData.spinSpeed * 0.04;
    pickup.position.y = pickup.userData.baseY + Math.sin(gameTime * 5) * 0.15;
    const distance = pickup.position.distanceTo(ball.position);
    if (distance < 1.35 && ball.position.y > BALL_GROUND_Y + 1) {
      pickup.visible = false;
      doubleScoreUntil = gameTime + DOUBLE_SCORE_SECONDS;
    }
    if (pickup.position.z < ball.position.z - 25) {
      pickup.visible = false;
    }
  }
}

function recycleWorld() {
  const theme = currentTheme();
  for (const obstacle of obstacles) {
    const obstacleHalfWidth = obstacle.userData.log ? (OBSTACLE_SIZE * SECOND_OBSTACLE_WIDTH_SCALE) / 2 : OBSTACLE_HALF_WIDTH;
    if (obstacle.userData.moving) {
      obstacle.position.x = obstacle.userData.baseX + Math.sin(gameTime * obstacle.userData.speed + obstacle.userData.phase) * obstacle.userData.range;
      obstacle.position.x = clampToVisibleTrack(obstacle.position.x, obstacleHalfWidth, 0.25);
    } else {
      obstacle.position.x = clampToVisibleTrack(obstacle.position.x, obstacleHalfWidth, 0.25);
    }
    if (obstacle.position.z < ball.position.z - 15) {
      let z = ball.position.z + rand(300, 450);
      let attempts = 0;
      while (!spaceAvailableForObstacle(z) && attempts < 12) {
        z += rand(24, 44);
        attempts += 1;
      }
      obstacle.position.set(safeX(z), OBSTACLE_CENTER_Y, z);
      obstacle.userData.baseX = obstacle.position.x;
      obstacle.userData.moving = Math.random() < 0.45;
      obstacle.userData.log = gameTime > LOG_OBSTACLE_START_TIME && Math.random() < 0.4;
      obstacle.scale.set(
        obstacle.userData.log ? SECOND_OBSTACLE_WIDTH_SCALE : 1,
        obstacle.userData.log ? SECOND_OBSTACLE_HEIGHT_SCALE : 1,
        obstacle.userData.log ? SECOND_OBSTACLE_DEPTH_SCALE : 1,
      );
      obstacle.position.y = TRACK_TOP_Y + ((obstacle.userData.log ? OBSTACLE_SIZE * SECOND_OBSTACLE_HEIGHT_SCALE : OBSTACLE_SIZE) / 2);
      obstacle.position.x = clampToVisibleTrack(obstacle.position.x, obstacle.userData.log ? (OBSTACLE_SIZE * SECOND_OBSTACLE_WIDTH_SCALE) / 2 : OBSTACLE_HALF_WIDTH, 0.25);
      obstacle.userData.baseX = obstacle.position.x;
      obstacle.userData.range = rand(0.45, Math.max(0.55, Math.min(2.6, availableMoveRange(obstacle.position.x, z, obstacle.userData.log ? (OBSTACLE_SIZE * SECOND_OBSTACLE_WIDTH_SCALE) / 2 : OBSTACLE_HALF_WIDTH))));
      obstacle.material.color.set(obstacle.userData.log ? theme[5] : theme[4]);
    }
  }

  for (const ramp of ramps) {
    ramp.position.x = clampToVisibleTrack(ramp.position.x, RAMP_HALF_WIDTH, 0.2);
    if (ramp.position.z < ball.position.z - 20) {
      let z = ball.position.z + rand(350, 500);
      let attempts = 0;
      while (!spaceAvailableForRamp(z) && attempts < 12) {
        z += rand(26, 48);
        attempts += 1;
      }
      const rampX = clampToVisibleTrack(visibleTrackCenter() + rand(-2, 2), RAMP_HALF_WIDTH, 0.2);
      ramp.position.set(rampX, 0.8, z);
      ramp.material.color.set(theme[3]);
      placeDoubleScorePickup(ramp.position.x, ramp.position.z);
    }
  }

  for (const building of buildings) {
    if (building.position.z < ball.position.z - 50) building.position.z = ball.position.z + rand(360, 640);
  }
  for (const cloud of clouds) {
    if (cloud.position.z < ball.position.z - 80) cloud.position.set(rand(-45, 45), rand(18, 30), ball.position.z + rand(360, 700));
  }
}

function checkObstacleHits() {
  if (falling) return;
  for (const obstacle of obstacles) {
    const dx = Math.abs(ball.position.x - obstacle.position.x);
    const dz = Math.abs(ball.position.z - obstacle.position.z);
    const dy = Math.abs(ball.position.y - obstacle.position.y);
    const halfX = (obstacle.userData.log ? OBSTACLE_SIZE * SECOND_OBSTACLE_WIDTH_SCALE : OBSTACLE_SIZE) / 2;
    const halfY = (obstacle.userData.log ? OBSTACLE_SIZE * SECOND_OBSTACLE_HEIGHT_SCALE : OBSTACLE_SIZE) / 2;
    const halfZ = (obstacle.userData.log ? OBSTACLE_SIZE * SECOND_OBSTACLE_DEPTH_SCALE : OBSTACLE_SIZE) / 2;
    if (dx < halfX + BALL_RADIUS * 0.92 && dz < halfZ + BALL_RADIUS * 0.92 && dy < halfY + BALL_RADIUS * 0.92) {
      ballMaterial.color.setHex(0x000000);
      endGame();
    }
  }
}

let last = performance.now();
function animate(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', (event) => {
  unlockAudio();
  keys.add(event.key.toLowerCase());
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
document.querySelectorAll('[data-touch-control]').forEach((control) => {
  const side = control.dataset.touchControl;
  const setPressed = (pressed) => {
    touchControls[side] = pressed;
    control.classList.toggle('pressed', pressed);
  };

  control.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    unlockAudio();
    control.setPointerCapture?.(event.pointerId);
    setPressed(true);
  });
  control.addEventListener('pointerup', () => setPressed(false));
  control.addEventListener('pointercancel', () => setPressed(false));
  control.addEventListener('lostpointercapture', () => setPressed(false));
});

document.querySelector('#start').addEventListener('click', resetGame);
document.querySelector('#return').addEventListener('click', () => {
  userStartedAudio = true;
  stopGameOverMusic();
  gameOverScreen.classList.add('hidden');
  menu.classList.remove('hidden');
  controlsHint.style.display = 'none';
  playMenuMusic();
  updateMenu();
});
document.querySelectorAll('[data-difficulty]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedDifficulty = button.dataset.difficulty;
    updateMenu();
  });
});
document.querySelectorAll('[data-skin]').forEach((button) => {
  button.addEventListener('click', () => {
    const requirement = skinRequirements[button.dataset.skin] ?? 0;
    if (hardRecord() < requirement) return;
    selectedSkin = button.dataset.skin;
    updateMenu();
  });
});

resize();
applyThemeForScore(0);
updateMenu();
playMenuMusic();
requestAnimationFrame(animate);
