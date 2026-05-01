// Realistic fireworks: rockets with trails + multi-pattern explosions.
// Mounts a fixed full-screen canvas, exposes window.__fxBurst() for triggered bursts.

(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'fireworks-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  (document.body || document.documentElement).appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  function resize() {
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  resize();
  addEventListener('resize', resize);

  const GRAVITY = 0.045 * DPR;
  const FRICTION = 0.985;
  const r = (a, b) => a + Math.random() * (b - a);

  // Тёплая праздничная палитра
  const PALETTES = [
    [255, 235, 180], // тёплый белый
    [255, 200, 100], // золото
    [255, 130, 60],  // оранжевый
    [255, 80, 80],   // красный
    [200, 130, 255], // пурпурный
    [120, 200, 255], // голубой
    [255, 240, 130], // янтарный
  ];
  const pickColor = () => PALETTES[(Math.random() * PALETTES.length) | 0];

  const rockets = [];
  const particles = [];

  function launchRocket(forceX) {
    const x = forceX != null ? forceX : r(W * 0.15, W * 0.85);
    const targetY = r(H * 0.12, H * 0.45);
    const vx = r(-0.6, 0.6) * DPR;
    const vy = -Math.sqrt(2 * GRAVITY * (H - targetY));
    rockets.push({
      x, y: H + 10, vx, vy,
      trail: [],
      color: pickColor(),
      pattern: Math.random(),
    });
  }

  function explode(x, y, color, pattern) {
    let count, sizeBase, speedBase, life;
    let kind;
    if (pattern < 0.35) { kind = 'peony'; count = 90; sizeBase = 2.0; speedBase = 4.5; life = [70, 110]; }
    else if (pattern < 0.6) { kind = 'chrysanthemum'; count = 130; sizeBase = 2.4; speedBase = 6.0; life = [80, 130]; }
    else if (pattern < 0.8) { kind = 'willow'; count = 70; sizeBase = 2.2; speedBase = 3.2; life = [120, 180]; }
    else { kind = 'palm'; count = 40; sizeBase = 3.0; speedBase = 5.5; life = [70, 110]; }

    for (let i = 0; i < count; i++) {
      let angle, speed;
      if (kind === 'palm') {
        // пальма — преимущественно вверх веером
        angle = -Math.PI / 2 + r(-0.9, 0.9);
        speed = (speedBase + r(-1, 1)) * DPR;
      } else {
        angle = (Math.PI * 2 * i) / count + r(-0.04, 0.04);
        speed = (speedBase * (kind === 'chrysanthemum' ? r(0.6, 1.0) : r(0.7, 1.0))) * DPR;
      }

      const isWillow = kind === 'willow';
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 0,
        maxLife: r(life[0], life[1]),
        size: r(sizeBase * 0.7, sizeBase) * DPR,
        sparkle: Math.random() < 0.35,
        gravityMul: isWillow ? 1.4 : 1.0,
        frictionMul: isWillow ? 0.97 : 0.985,
        kind,
      });
    }
  }

  // Триггер из вне — салют над точкой (по умолчанию центр)
  window.__fxBurst = function (x, y, salvos) {
    const cx = (x != null ? x * DPR : W * 0.5);
    const cy = (y != null ? y * DPR : H * 0.4);
    const n = salvos || 5;
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const sx = cx + r(-W * 0.18, W * 0.18);
        const targetY = cy + r(-H * 0.08, H * 0.08);
        const vx = r(-0.5, 0.5) * DPR;
        const vy = -Math.sqrt(2 * GRAVITY * (H - targetY));
        rockets.push({
          x: sx, y: H + 10, vx, vy, trail: [],
          color: pickColor(), pattern: Math.random()
        });
      }, i * 280);
    }
  };

  let lastLaunch = 0, nextDelay = 1800;
  function tick(now) {
    // плавное затухание прошлых кадров (трейлы)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; // аддитивное свечение

    // авто-запуск
    if (now - lastLaunch > nextDelay) {
      launchRocket();
      if (Math.random() < 0.25) setTimeout(launchRocket, 220);
      lastLaunch = now;
      nextDelay = r(1800, 4200);
    }

    // ракеты
    for (let i = rockets.length - 1; i >= 0; i--) {
      const k = rockets[i];
      k.trail.push({ x: k.x, y: k.y });
      if (k.trail.length > 10) k.trail.shift();
      k.x += k.vx; k.y += k.vy; k.vy += GRAVITY;

      // трейл ракеты
      for (let t = 0; t < k.trail.length; t++) {
        const p = k.trail[t];
        const a = (t + 1) / k.trail.length * 0.7;
        ctx.fillStyle = `rgba(255,225,160,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1.2 + t * 0.1) * DPR, 0, Math.PI * 2);
        ctx.fill();
      }

      // верхняя точка → взрыв
      if (k.vy >= 0) {
        explode(k.x, k.y, k.color, k.pattern);
        rockets.splice(i, 1);
      }
    }

    // частицы
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += GRAVITY * p.gravityMul;
      p.vx *= p.frictionMul; p.vy *= p.frictionMul;
      p.life++;

      if (p.life > p.maxLife) { particles.splice(i, 1); continue; }

      const t = p.life / p.maxLife;
      const alpha = (1 - t) * (p.sparkle ? (0.5 + Math.random() * 0.5) : 1);
      const sz = p.size * (1 - t * 0.5);

      // ядро
      ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fill();

      // мягкий halo
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 4);
      grd.addColorStop(0, `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${alpha * 0.4})`);
      grd.addColorStop(1, `rgba(${p.color[0]},${p.color[1]},${p.color[2]},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
