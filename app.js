// =====================================================================
//  LUCARIO RUSH – game.js
// =====================================================================

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const abilityBar = document.getElementById('ability-bar');
const overlay    = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub   = document.getElementById('overlay-subtitle');
const startBtn     = document.getElementById('start-btn');
const hiScoreEl    = document.getElementById('hi-score-display');

canvas.width  = 900;
canvas.height = 420;

const W = canvas.width, H = canvas.height;
const GROUND = H - 70;
const GRAVITY = 0.55;
const JUMP_FORCE = -13.5;
const BASE_SPEED = 5;

const PHASES = [
  { name: 'Nacht-Stadt',   sky: ['#0a0a1a','#101030'],  ground: '#1a1a3a', accent: '#6496ff', fog: 'rgba(40,60,180,0.08)'  },
  { name: 'Aura-Wüste',    sky: ['#1a0a00','#2a1000'],  ground: '#3a1800', accent: '#ff9040', fog: 'rgba(200,100,0,0.08)'   },
  { name: 'Eistal',        sky: ['#001020','#002040'],   ground: '#003050', accent: '#60d8ff', fog: 'rgba(0,140,200,0.10)'   },
  { name: 'Kampf-Arena',   sky: ['#200008','#3a0010'],   ground: '#2a0008', accent: '#ff4070', fog: 'rgba(200,0,60,0.10)'    },
  { name: 'Aura-Nexus',    sky: ['#080020','#180040'],   ground: '#120030', accent: '#c060ff', fog: 'rgba(160,0,255,0.12)'   },
];

let score, hiScore, speed, phase, phaseProgress;
let particles, obstacles, bgObjects;
let abilityCharge, abilityActive, abilityTimer;
let gameRunning, gameOver;
let animFrame;
let auraWave = 0;

const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!gameRunning) return;
  if ((e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') && !gameOver) {
    e.preventDefault();
  }
  if (e.code === 'Space' && !gameOver) {
    triggerAbility();
  }
  if ((e.code === 'ArrowUp' || e.code === 'KeyW') && !gameOver) {
    playerJump();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('pointerdown', () => {
  if (gameRunning && !gameOver) playerJump();
});

const player = {
  x: 110, y: GROUND, w: 40, h: 50,
  vy: 0, jumps: 0, maxJumps: 2,
  frame: 0, frameTimer: 0,
  invincible: 0,
  reset() {
    this.y = GROUND; this.vy = 0;
    this.jumps = 0; this.frame = 0; this.invincible = 0;
  }
};

function playerJump() {
  if (player.jumps < player.maxJumps) {
    player.vy = JUMP_FORCE * (player.jumps === 1 ? 0.82 : 1);
    player.jumps++;
    spawnJumpParticles();
  }
}

const OBS_TYPES = [
  { id:'spike',  w:28, h:36, color:'#aaaacc' },
  { id:'crate',  w:38, h:38, color:'#6a4a20' },
  { id:'floater',w:36, h:24, color:'#ff6040', floatY: true, floatAmp: 45 },
  { id:'tall',   w:22, h:70, color:'#3a5a8a' },
  { id:'double', w:28, h:36, color:'#cc88aa', double: true },
];

function init() {
  score = 0;
  speed = BASE_SPEED;
  phase = 0;
  phaseProgress = 0;
  particles  = [];
  obstacles  = [];
  bgObjects  = [];
  abilityCharge = 0;
  abilityActive = false;
  abilityTimer  = 0;
  gameRunning = true;
  gameOver    = false;
  player.reset();
  generateBgObjects();

  scoreEl.textContent = '0';
  abilityBar.style.width = '0%';
  overlay.classList.remove('active');

  if (animFrame) cancelAnimationFrame(animFrame);
  lastTime = 0;
  obstacleTimer = 80;
  loop();
}

function generateBgObjects() {
  bgObjects = [];
  for (let i = 0; i < 14; i++) {
    bgObjects.push({
      x: Math.random() * W * 2,
      y: 30 + Math.random() * (GROUND - 100),
      size: 10 + Math.random() * 40,
      speed: 0.3 + Math.random() * 0.8,
      type: Math.floor(Math.random() * 3),
      alpha: 0.10 + Math.random() * 0.16
    });
  }
}

let lastTime = 0;
let obstacleTimer = 80;

function loop(ts = 0) {
  const dt = Math.min((ts - lastTime) / 16.67, 2.5);
  lastTime = ts;
  update(dt, ts);
  draw(ts);
  animFrame = requestAnimationFrame(loop);
}

function update(dt, ts) {
  if (gameOver) {
    // still update particles after death
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 0.18 * dt;
      p.life -= dt * 0.035;
      if (p.life <= 0) particles.splice(i, 1);
    }
    return;
  }

  score += dt * 0.6;
  scoreEl.textContent = Math.floor(score);
  speed = BASE_SPEED + Math.floor(score / 200) * 0.55;
  speed = Math.min(speed, 13);

  const targetPhase = Math.min(Math.floor(score / 600), PHASES.length - 1);
  if (targetPhase > phase) phase = targetPhase;

  if (!abilityActive) {
    abilityCharge = Math.min(abilityCharge + 0.0028 * dt, 1);
    abilityBar.style.width = (abilityCharge * 100) + '%';
  } else {
    abilityTimer -= dt;
    if (abilityTimer <= 0) {
      abilityActive = false;
      player.invincible = 0;
    }
  }
  auraWave += 0.08 * dt;

  player.vy += GRAVITY * dt;
  player.y  += player.vy * dt;
  if (player.y >= GROUND) {
    player.y = GROUND;
    player.vy = 0;
    player.jumps = 0;
  }

  player.frameTimer += dt;
  if (player.frameTimer > 6) { player.frame = (player.frame + 1) % 4; player.frameTimer = 0; }

  if (player.invincible > 0) player.invincible -= dt;

  obstacleTimer -= dt;
  if (obstacleTimer <= 0) {
    spawnObstacle();
    obstacleTimer = 52 + Math.random() * 55 - Math.min(score / 80, 28);
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= speed * dt;
    if (o.floatY) o.y = GROUND - o.h - o.floatAmp * (0.5 + 0.5 * Math.sin(o.phase + ts * 0.002));
    if (o.x + o.w < -60) { obstacles.splice(i, 1); continue; }

    if (player.invincible <= 0 && !abilityActive) {
      const px = player.x + 9, pw = player.w - 18;
      const py = player.y - player.h + 8, ph = player.h - 14;
      if (px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y) {
        triggerDeath(); return;
      }
      if (o.double) {
        const o2x = o.x + o.w + 30;
        if (px < o2x + o.w && px + pw > o2x && py < o.y + o.h && py + ph > o.y) {
          triggerDeath(); return;
        }
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 0.15 * dt;
    p.life -= dt * 0.04;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (const b of bgObjects) {
    b.x -= b.speed * dt;
    if (b.x + b.size < 0) {
      b.x = W + Math.random() * 100;
      b.y = 30 + Math.random() * (GROUND - 100);
    }
  }
}

// ─── DRAW ─────────────────────────────────────────────────────────────
function draw(ts) {
  const p = PHASES[phase];

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, p.sky[0]);
  sky.addColorStop(1, p.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  drawStars(p, ts);
  drawBgObjects(p);

  ctx.fillStyle = p.fog;
  ctx.fillRect(0, GROUND - 60, W, 80);

  const grd = ctx.createLinearGradient(0, GROUND, 0, H);
  grd.addColorStop(0, lighten(p.ground, 18));
  grd.addColorStop(1, p.ground);
  ctx.fillStyle = grd;
  ctx.fillRect(0, GROUND, W, H - GROUND);

  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (abilityActive) drawAuraBurst(p);

  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const o of obstacles) drawObstacle(o, p, ts);

  drawLucario(p);
}

function drawStars(p, ts) {
  if (!drawStars.cache) {
    drawStars.cache = Array.from({length: 70}, () => ({
      x: Math.random() * W, y: Math.random() * GROUND * 0.72,
      r: 0.5 + Math.random() * 1.5,
      twinkle: Math.random() * Math.PI * 2
    }));
  }
  for (const s of drawStars.cache) {
    s.twinkle += 0.015;
    const alpha = 0.2 + 0.5 * Math.sin(s.twinkle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBgObjects(p) {
  for (const b of bgObjects) {
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = p.accent;
    if (b.type === 0) {
      const bh = b.size + 30;
      ctx.fillRect(b.x, GROUND - bh, b.size * 0.6, bh);
      ctx.fillRect(b.x + b.size * 0.1, GROUND - bh - b.size * 0.28, b.size * 0.4, b.size * 0.28);
    } else if (b.type === 1) {
      ctx.beginPath();
      ctx.moveTo(b.x, GROUND - b.size);
      ctx.lineTo(b.x + b.size * 0.28, GROUND);
      ctx.lineTo(b.x - b.size * 0.28, GROUND);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.size, b.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawObstacle(o, p, ts) {
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 5;
  if (o.id === 'spike') {
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2, o.y);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.lineTo(o.x, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2, o.y);
    ctx.lineTo(o.x + o.w * 0.66, o.y + o.h * 0.45);
    ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (o.id === 'crate') {
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
    ctx.beginPath();
    ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x, o.y + o.h);
    ctx.stroke();
  } else if (o.id === 'floater') {
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const pulse = 0.08 + 0.06 * Math.sin(ts * 0.004);
    ctx.fillStyle = `rgba(255,100,60,${pulse})`;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h + 4, o.w * 0.3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.id === 'tall') {
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(o.x + 4, o.y + 4, 6, o.h - 8);
  } else if (o.id === 'double') {
    for (let i = 0; i < 2; i++) {
      const ox = o.x + i * (o.w + 30);
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.moveTo(ox + o.w / 2, o.y);
      ctx.lineTo(ox + o.w, o.y + o.h);
      ctx.lineTo(ox, o.y + o.h);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

function drawLucario(p) {
  const x = player.x;
  const y = player.y - player.h;
  const bobY = player.y >= GROUND ? Math.sin(player.frame * 1.5) * 1.8 : 0;

  ctx.save();
  if (player.invincible > 0 && Math.floor(player.invincible * 8) % 2 === 0) ctx.globalAlpha = 0.35;

  if (abilityActive) { ctx.shadowColor = '#80c0ff'; ctx.shadowBlur = 28; }
  else { ctx.shadowColor = p.accent; ctx.shadowBlur = 7; }

  // Body
  ctx.fillStyle = '#2060c0';
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 15 + bobY, 24, 25, 4);
  ctx.fill();

  // Chest
  ctx.fillStyle = '#a0c0ff';
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 27 + bobY, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Aura sensor spike
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 17 + bobY);
  ctx.lineTo(x + 23, y + 27 + bobY);
  ctx.lineTo(x + 17, y + 27 + bobY);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = '#2060c0';
  ctx.beginPath();
  ctx.arc(x + 20, y + 10 + bobY, 11, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#0a0a20';
  ctx.beginPath();
  ctx.moveTo(x + 11, y + 2 + bobY);
  ctx.lineTo(x + 14, y + 12 + bobY);
  ctx.lineTo(x + 7, y + 12 + bobY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 29, y + 2 + bobY);
  ctx.lineTo(x + 33, y + 12 + bobY);
  ctx.lineTo(x + 26, y + 12 + bobY);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#ff3030';
  ctx.beginPath();
  ctx.ellipse(x + 15, y + 9 + bobY, 3, 3.5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 25, y + 9 + bobY, 3, 3.5, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x + 15, y + 9 + bobY, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 25, y + 9 + bobY, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#90b0e0';
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 14 + bobY, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  const legSwing = player.y >= GROUND ? Math.sin(player.frame * 1.6) * 7 : 0;
  ctx.fillStyle = '#1850a0';
  ctx.fillRect(x + 10, y + 38 + bobY, 8, 14);
  ctx.fillRect(x + 22, y + 38 + bobY, 8, 14);
  ctx.fillStyle = '#0a0a20';
  ctx.beginPath();
  ctx.ellipse(x + 14, y + 52 + bobY, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 26, y + 52 + bobY, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.strokeStyle = '#1850a0';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 32 + bobY);
  ctx.quadraticCurveTo(x - 12, y + 22 + bobY, x - 3, y + 10 + bobY);
  ctx.stroke();
  ctx.fillStyle = '#a0c0ff';
  ctx.beginPath();
  ctx.arc(x - 3, y + 10 + bobY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  const armSwing = player.y >= GROUND ? Math.sin(player.frame * 1.6) * 5 : 0;
  ctx.strokeStyle = '#2060c0';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 20 + bobY);
  ctx.lineTo(x + 0, y + 31 + armSwing + bobY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 32, y + 20 + bobY);
  ctx.lineTo(x + 40, y + 31 - armSwing + bobY);
  ctx.stroke();

  ctx.fillStyle = '#90b0e0';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x + 0, y + 31 + armSwing + bobY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 40, y + 31 - armSwing + bobY, 5, 0, Math.PI * 2);
  ctx.fill();

  if (abilityActive) {
    const wave = Math.sin(auraWave) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(100,180,255,${0.6 + wave * 0.4})`;
    ctx.shadowColor = '#60b8ff';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(x + 0, y + 31 + armSwing + bobY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 40, y + 31 - armSwing + bobY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawAuraBurst(p) {
  const wave = Math.sin(auraWave * 2) * 0.5 + 0.5;
  const cx = player.x + 20, cy = player.y - player.h / 2;
  for (let i = 0; i < 3; i++) {
    const r = 58 + i * 28 + wave * 14;
    ctx.strokeStyle = `rgba(100,180,255,${0.13 - i * 0.03})`;
    ctx.lineWidth = 3 - i;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const grd = ctx.createRadialGradient(cx, cy, 4, cx, cy, 54);
  grd.addColorStop(0, `rgba(120,200,255,${0.22 + wave * 0.13})`);
  grd.addColorStop(1, `rgba(60,100,255,0)`);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, 54, 0, Math.PI * 2);
  ctx.fill();
}

function spawnObstacle() {
  const pool = score < 400 ? OBS_TYPES.slice(0, 3) :
               score < 800 ? OBS_TYPES.slice(0, 4) : OBS_TYPES;
  const t = pool[Math.floor(Math.random() * pool.length)];
  const o = { ...t, x: W + 20, y: GROUND - t.h, phase: Math.random() * Math.PI * 2 };
  if (t.floatY) { o.floatAmp = t.floatAmp; o.y = GROUND - t.h - o.floatAmp * 0.5; }
  obstacles.push(o);
}

function spawnJumpParticles() {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: player.x + 20, y: player.y,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * -3 - 1,
      r: 2 + Math.random() * 4,
      color: Math.random() > 0.5 ? '#60a0ff' : '#a0d0ff',
      life: 0.8 + Math.random() * 0.4
    });
  }
}

function spawnDeathParticles() {
  for (let i = 0; i < 30; i++) {
    const angle = (Math.PI * 2 / 30) * i;
    particles.push({
      x: player.x + 20, y: player.y - player.h / 2,
      vx: Math.cos(angle) * (2 + Math.random() * 5),
      vy: Math.sin(angle) * (2 + Math.random() * 5) - 3,
      r: 3 + Math.random() * 5,
      color: ['#ff4040','#ff8040','#4080ff','#ffffff'][Math.floor(Math.random() * 4)],
      life: 1
    });
  }
}

function triggerAbility() {
  if (abilityCharge < 1) return;
  abilityCharge = 0;
  abilityBar.style.width = '0%';
  abilityActive = true;
  abilityTimer  = 180;
  player.invincible = 180;
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 20 + Math.random() * 60;
    particles.push({
      x: player.x + 20 + Math.cos(angle) * dist,
      y: player.y - player.h / 2 + Math.sin(angle) * dist,
      vx: Math.cos(angle) * (1 + Math.random() * 2),
      vy: Math.sin(angle) * (1 + Math.random() * 2),
      r: 3 + Math.random() * 6,
      color: Math.random() > 0.5 ? '#60b0ff' : '#c0e0ff',
      life: 0.9
    });
  }
}

function triggerDeath() {
  gameOver = true;
  gameRunning = false;
  spawnDeathParticles();

  const hs = parseInt(localStorage.getItem('lucario_hi') || '0');
  const current = Math.floor(score);
  if (current > hs) localStorage.setItem('lucario_hi', current);
  const newHi = Math.max(current, hs);
  hiScoreEl.textContent = `HI-SCORE: ${newHi}`;

  setTimeout(() => {
    overlayTitle.textContent = 'GAME OVER';
    overlaySub.textContent   = `Score: ${current}   •   Phase: ${PHASES[phase].name}`;
    startBtn.textContent     = 'NOCHMAL';
    overlay.classList.add('active');
  }, 1100);
}

function lighten(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

startBtn.addEventListener('click', init);

const storedHi = localStorage.getItem('lucario_hi');
if (storedHi) hiScoreEl.textContent = `HI-SCORE: ${storedHi}`;
