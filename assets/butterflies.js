// Realistic butterflies: SVG with 3D wing flap, drifting on layered sinusoid paths.

(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const COUNT = 5;
  const SPECIES = [
    // Monarch — оранжевый с чёрной окантовкой
    { wing: '#e8861f', vein: '#3a1808', edge: '#1a0a04', dot: '#fff5c2', body: '#1a0a04' },
    // Blue Morpho — небесно-синий
    { wing: '#3a8fe0', vein: '#0a1c3a', edge: '#08152a', dot: '#c4e6ff', body: '#0a1c3a' },
    // Purple Emperor — пурпур + золото
    { wing: '#7a2ec0', vein: '#2a0a48', edge: '#180430', dot: '#ffd877', body: '#2a0a48' },
    // Cardinal — красный
    { wing: '#c8204a', vein: '#400a18', edge: '#280408', dot: '#fff0d0', body: '#280408' },
    // Tiger Swallowtail — жёлто-чёрный
    { wing: '#f0c840', vein: '#3a2810', edge: '#1a0e04', dot: '#fff5c2', body: '#1a0e04' },
  ];

  function svgFor(s) {
    return `
<svg viewBox="-60 -50 120 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="overflow:visible">
  <!-- ЛЕВОЕ КРЫЛО -->
  <g class="b-wing b-wing--l">
    <!-- верхнее крыло: большая капля -->
    <ellipse cx="-26" cy="-14" rx="28" ry="22" fill="${s.wing}" stroke="${s.edge}" stroke-width="1.5"/>
    <!-- нижнее крыло: меньшая капля -->
    <ellipse cx="-20" cy="16" rx="20" ry="16" fill="${s.wing}" stroke="${s.edge}" stroke-width="1.5"/>
    <!-- глазок и точки -->
    <circle cx="-32" cy="-16" r="4" fill="${s.dot}"/>
    <circle cx="-32" cy="-16" r="1.8" fill="${s.edge}"/>
    <circle cx="-22" cy="20" r="2.8" fill="${s.dot}" opacity=".85"/>
    <!-- прожилка -->
    <path d="M-2,-6 Q-22,-22 -44,-18" stroke="${s.vein}" stroke-width="1" fill="none" opacity=".55"/>
    <path d="M-2,8 Q-18,18 -32,22" stroke="${s.vein}" stroke-width="1" fill="none" opacity=".5"/>
  </g>
  <!-- ПРАВОЕ КРЫЛО -->
  <g class="b-wing b-wing--r">
    <ellipse cx="26" cy="-14" rx="28" ry="22" fill="${s.wing}" stroke="${s.edge}" stroke-width="1.5"/>
    <ellipse cx="20" cy="16" rx="20" ry="16" fill="${s.wing}" stroke="${s.edge}" stroke-width="1.5"/>
    <circle cx="32" cy="-16" r="4" fill="${s.dot}"/>
    <circle cx="32" cy="-16" r="1.8" fill="${s.edge}"/>
    <circle cx="22" cy="20" r="2.8" fill="${s.dot}" opacity=".85"/>
    <path d="M2,-6 Q22,-22 44,-18" stroke="${s.vein}" stroke-width="1" fill="none" opacity=".55"/>
    <path d="M2,8 Q18,18 32,22" stroke="${s.vein}" stroke-width="1" fill="none" opacity=".5"/>
  </g>
  <!-- ТЕЛО -->
  <ellipse cx="0" cy="-2" rx="3" ry="20" fill="${s.body}"/>
  <ellipse cx="0" cy="-18" rx="3.4" ry="4" fill="${s.body}"/>
  <!-- УСИКИ -->
  <path d="M-1.8,-20 Q-7,-30 -10,-32" stroke="${s.body}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <path d="M1.8,-20 Q7,-30 10,-32" stroke="${s.body}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <circle cx="-10" cy="-32" r="1.2" fill="${s.body}"/>
  <circle cx="10" cy="-32" r="1.2" fill="${s.body}"/>
</svg>`;
  }

  const layer = document.createElement('div');
  layer.className = 'butterflies';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const butterflies = [];
  for (let i = 0; i < COUNT; i++) {
    const s = { ...SPECIES[i % SPECIES.length], idx: i };
    const el = document.createElement('div');
    el.className = 'butterfly';
    el.innerHTML = svgFor(s);
    const scale = 0.55 + Math.random() * 0.55;
    const flapMs = 180 + Math.random() * 140;
    el.style.setProperty('--scale', scale);
    el.style.setProperty('--flap', flapMs + 'ms');
    el.style.setProperty('--delay', -Math.random() * 5 + 's');
    layer.appendChild(el);
    butterflies.push({
      el,
      seed: Math.random() * 1000,
      speed: 0.00018 + Math.random() * 0.00022,
      ax: 0.34 + Math.random() * 0.16,
      ay: 0.28 + Math.random() * 0.16,
      f1: 1 + Math.random() * 0.4,
      f2: 1.6 + Math.random() * 0.8,
      px: -1e4, py: -1e4, // last position for direction
    });
  }

  let raf, t0 = performance.now();
  function loop(now) {
    const t = (now - t0);
    const cx = innerWidth * 0.5;
    const cy = innerHeight * 0.5;

    butterflies.forEach((b, i) => {
      const phase = b.seed + t * b.speed;
      // фигура Лиссажу + шум
      const x = cx + Math.cos(phase * b.f1 + i * 1.3) * innerWidth * b.ax
                  + Math.sin(phase * 2.7 + i) * innerWidth * 0.05;
      const y = cy + Math.sin(phase * b.f2 + i * 0.7) * innerHeight * b.ay
                  + Math.cos(phase * 3.1 + i) * innerHeight * 0.04;

      const dx = x - b.px, dy = y - b.py;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90; // нос вверх
      // не дёргаемся при инициализации
      if (b.px < -1000) { b.px = x; b.py = y; angle = 0; }

      const flipX = Math.cos(angle * Math.PI / 180) < 0 ? -1 : 1;
      const tilt = Math.cos(phase * 4) * 8; // лёгкое покачивание

      b.el.style.transform =
        `translate3d(${x}px, ${y}px, 0) ` +
        `rotate(${angle}deg) ` +
        `rotateX(${tilt}deg)`;
      b.px = x; b.py = y;
    });
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else { t0 = performance.now() - 1000; raf = requestAnimationFrame(loop); }
  });
})();
