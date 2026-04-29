(async () => {
  'use strict';

  // ============= 0. SHADER BACKGROUND (Three.js) =============
  (function initShader() {
    if (typeof THREE === 'undefined') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const host = document.getElementById('bgFx');
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight);
    host.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(innerWidth, innerHeight) }
      },
      vertexShader: `void main(){gl_Position = vec4(position,1.0);}`,
      fragmentShader: `
        precision highp float;
        uniform float iTime;
        uniform vec2 iResolution;
        #define NUM_OCTAVES 3
        float rand(vec2 n){return fract(sin(dot(n, vec2(12.9898,4.1414)))*43758.5453);}
        float noise(vec2 p){
          vec2 ip = floor(p); vec2 u = fract(p); u = u*u*(3.0-2.0*u);
          float res = mix(mix(rand(ip),rand(ip+vec2(1,0)),u.x),
                          mix(rand(ip+vec2(0,1)),rand(ip+vec2(1,1)),u.x),u.y);
          return res*res;
        }
        float fbm(vec2 x){
          float v=0.0; float a=0.3;
          vec2 shift = vec2(100.0);
          mat2 rot = mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
          for(int i=0;i<NUM_OCTAVES;++i){ v += a*noise(x); x = rot*x*2.0 + shift; a *= 0.4; }
          return v;
        }
        void main(){
          vec2 shake = vec2(sin(iTime*1.2)*0.005, cos(iTime*2.1)*0.005);
          vec2 p = ((gl_FragCoord.xy + shake*iResolution.xy) - iResolution.xy*0.5) / iResolution.y * mat2(6.0,-4.0,4.0,6.0);
          vec2 v;
          vec4 o = vec4(0.0);
          float f = 2.0 + fbm(p + vec2(iTime*5.0, 0.0)) * 0.5;
          for(float i=0.0; i<35.0; i++){
            v = p + cos(i*i + (iTime + p.x*0.08)*0.025 + i*vec2(13.0,11.0))*3.5
                  + vec2(sin(iTime*3.0+i)*0.003, cos(iTime*3.5-i)*0.003);
            float tailNoise = fbm(v + vec2(iTime*0.5, i)) * 0.3 * (1.0 - (i/35.0));
            // ТЁПЛАЯ ПАЛИТРА: золото / янтарь / бордо
            vec4 auroraColors = vec4(
              0.55 + 0.45 * sin(i*0.20 + iTime*0.40),     // R: насыщенный
              0.28 + 0.30 * cos(i*0.30 + iTime*0.50),     // G: тёплый янтарь
              0.05 + 0.15 * sin(i*0.40 + iTime*0.30),     // B: минимум, чтобы не уходить в синь
              1.0
            );
            vec4 currentContribution = auroraColors * exp(sin(i*i + iTime*0.8))
              / length(max(v, vec2(v.x*f*0.015, v.y*1.5)));
            float thinnessFactor = smoothstep(0.0, 1.0, i/35.0) * 0.6;
            o += currentContribution * (1.0 + tailNoise*0.8) * thinnessFactor;
          }
          o = tanh(pow(o/100.0, vec4(1.6)));
          gl_FragColor = vec4(o.rgb * 1.4, 1.0);
        }
      `
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    let raf, t0 = performance.now();
    function loop() {
      material.uniforms.iTime.value = (performance.now() - t0) / 1000;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }
    loop();

    // плавно проявить шейдер
    requestAnimationFrame(() => host.classList.add('is-on'));

    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      material.uniforms.iResolution.value.set(innerWidth, innerHeight);
    });

    // выключить, если вкладка в фоне (экономия CPU)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else loop();
    });
  })();

  // ============= 1. CURTAIN OPEN ON LOAD =============
  const curtain = document.getElementById('curtain');
  const openCurtain = () => {
    setTimeout(() => curtain.classList.add('is-open'), 800);
    setTimeout(() => curtain.classList.add('is-gone'), 4400);
  };
  if (document.readyState === 'complete') openCurtain();
  else window.addEventListener('load', openCurtain);

  // ============= 2. REVEAL ON SCROLL =============
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ============= 3. GUEST NAME FROM URL =============
  // Поддерживаем ?n=<id> (короткий код) и ?name=<строка>
  const params = new URLSearchParams(location.search);
  const guestId = params.get('n');
  const explicitName = params.get('name');
  const nameEl = document.getElementById('guestName');
  const addresseeSection = document.getElementById('addressee');

  // guests.json опционален — если есть, оттуда возьмём имя
  let guestName = null;
  if (explicitName) {
    guestName = decodeURIComponent(explicitName);
  } else if (guestId) {
    try {
      const res = await fetch('guests.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data[guestId]) guestName = data[guestId];
      }
    } catch (_) { /* offline / no file — fall through */ }
  }

  if (guestName) {
    nameEl.textContent = guestName;
  } else {
    // общее приглашение — прячем секцию с именем
    if (addresseeSection) addresseeSection.style.display = 'none';
  }

  // ============= 4. PARTICLES (gold dust + sparkles + mouse interaction) =============
  const cvs = document.getElementById('particles');
  const ctx = cvs.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W, H, dust = [], sparkles = [];
  const DUST_N = 80;
  const mouse = { x: -1e4, y: -1e4, has: false };

  function resize() {
    W = cvs.width = innerWidth * DPR;
    H = cvs.height = innerHeight * DPR;
    cvs.style.width = innerWidth + 'px';
    cvs.style.height = innerHeight + 'px';
  }
  function spawnDust() {
    dust = Array.from({ length: DUST_N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: (Math.random() * 1.4 + 0.4) * DPR,
      vy: (Math.random() * 0.25 + 0.06) * DPR,
      vx: (Math.random() - 0.5) * 0.15 * DPR,
      a: Math.random() * 0.55 + 0.2,
      ph: Math.random() * Math.PI * 2,
      tw: Math.random() * 0.8 + 0.4, // twinkle speed
    }));
  }
  function addSparkle(x, y) {
    sparkles.push({
      x, y,
      r: (Math.random() * 2 + 2) * DPR,
      life: 0,
      max: 60 + Math.random() * 40,
      rays: 4 + ((Math.random() * 3) | 0),
      rot: Math.random() * Math.PI,
    });
  }
  // periodically spawn a sparkle somewhere
  setInterval(() => {
    if (sparkles.length < 8) addSparkle(Math.random() * W, Math.random() * H * 0.7);
  }, 1100);

  addEventListener('mousemove', (e) => {
    mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; mouse.has = true;
  });
  addEventListener('mouseleave', () => { mouse.has = false; mouse.x = mouse.y = -1e4; });
  addEventListener('click', (e) => {
    // burst of sparkles on click
    for (let i = 0; i < 8; i++) addSparkle(e.clientX * DPR + (Math.random() - 0.5) * 60 * DPR, e.clientY * DPR + (Math.random() - 0.5) * 60 * DPR);
  });

  function drawSparkle(s) {
    const k = s.life / s.max;
    const alpha = Math.sin(k * Math.PI);
    const size = s.r * (0.6 + Math.sin(k * Math.PI) * 1.2);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot + k * 0.8);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,235,180,1)';
    ctx.lineWidth = 1 * DPR;
    ctx.shadowColor = 'rgba(255,216,119,.9)';
    ctx.shadowBlur = 12 * DPR;
    for (let i = 0; i < s.rays; i++) {
      const a = (Math.PI * 2 * i) / s.rays;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * size * 4, Math.sin(a) * size * 4);
      ctx.stroke();
    }
    // core
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
    grd.addColorStop(0, 'rgba(255,255,255,.95)');
    grd.addColorStop(0.4, 'rgba(255,216,119,.6)');
    grd.addColorStop(1, 'rgba(255,216,119,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function tick(t) {
    ctx.clearRect(0, 0, W, H);
    // dust
    dust.forEach(p => {
      // mouse repulsion
      if (mouse.has) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        const R = 130 * DPR;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * 0.8;
          p.x += (dx / d) * f * 2;
          p.y += (dy / d) * f * 2;
        }
      }
      p.x += p.vx + Math.sin((t / 1000) * p.tw + p.ph) * 0.18;
      p.y += p.vy;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;

      const tw = 0.6 + Math.sin(t / 600 * p.tw + p.ph) * 0.4;
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      grd.addColorStop(0, `rgba(255,235,180,${p.a * tw})`);
      grd.addColorStop(1, 'rgba(255,235,180,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
      ctx.fill();
    });
    // sparkles
    sparkles = sparkles.filter(s => s.life < s.max);
    sparkles.forEach(s => { s.life++; drawSparkle(s); });

    requestAnimationFrame(tick);
  }
  resize(); spawnDust();
  addEventListener('resize', () => { resize(); spawnDust(); });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(tick);

  // ============= 5. RSVP =============
  const buttonsWrap = document.getElementById('rsvpButtons');
  const wishBlock = document.getElementById('wishBlock');
  const wishInput = document.getElementById('wish');
  const sendBtn = document.getElementById('sendBtn');
  const statusEl = document.getElementById('rsvpStatus');

  let chosen = null;

  buttonsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn[data-answer]');
    if (!btn) return;
    chosen = btn.dataset.answer;
    buttonsWrap.querySelectorAll('.btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    wishBlock.hidden = false;
    wishBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
    wishInput.focus({ preventScroll: true });
  });

  sendBtn.addEventListener('click', async () => {
    if (!chosen) return;
    sendBtn.disabled = true;
    statusEl.className = 'rsvp__status';
    statusEl.textContent = 'Отправляем...';

    const payload = {
      answer: chosen,
      name: guestName || 'Гость без имени',
      guestId: guestId || null,
      wish: (wishInput.value || '').trim().slice(0, 500),
      ts: new Date().toISOString(),
      ua: navigator.userAgent,
    };

    // PREVIEW MODE: на GitHub Pages бэкенда нет — имитируем успех
    const isPreview = /\.github\.io$/.test(location.hostname) || location.protocol === 'file:';
    try {
      if (isPreview) {
        await new Promise(r => setTimeout(r, 700));
      } else {
        const res = await fetch('/.netlify/functions/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      }
      statusEl.classList.add('success');
      statusEl.textContent = chosen === 'yes'
        ? 'Спасибо! Ждём вас на празднике ✨'
        : 'Спасибо за ответ. Будем скучать.';
      if (chosen === 'yes') confetti();
      wishBlock.style.opacity = '0.5';
      wishInput.disabled = true;
    } catch (err) {
      statusEl.classList.add('error');
      statusEl.textContent = 'Не удалось отправить. Попробуйте позже или напишите нам.';
      sendBtn.disabled = false;
    }
  });

  // ============= 6. CONFETTI =============
  function confetti() {
    const c = document.createElement('canvas');
    c.className = 'confetti';
    document.body.appendChild(c);
    const cx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const colors = ['#fff5c2', '#e8c46b', '#b58a3a', '#ffffff'];
    const pieces = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: innerHeight / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 14 - 6,
      g: 0.35,
      r: Math.random() * 6 + 3,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[(Math.random() * colors.length) | 0],
    }));
    let frames = 0;
    (function loop() {
      cx.clearRect(0, 0, c.width, c.height);
      pieces.forEach(p => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        cx.save();
        cx.translate(p.x, p.y); cx.rotate(p.rot);
        cx.fillStyle = p.color;
        cx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        cx.restore();
      });
      if (frames++ < 240) requestAnimationFrame(loop);
      else c.remove();
    })();
  }

  // ============= 7. MUSIC =============
  const music = document.getElementById('bgMusic');
  const musicBtn = document.getElementById('musicToggle');
  const iconOn = musicBtn.querySelector('.ico-on');
  const iconOff = musicBtn.querySelector('.ico-off');
  const hint = document.getElementById('soundHint');

  const TARGET_VOLUME = 0.35;
  let started = false;

  function setIcon(playing) {
    iconOn.style.display = playing ? '' : 'none';
    iconOff.style.display = playing ? 'none' : '';
    musicBtn.classList.toggle('is-playing', playing);
  }
  setIcon(false);

  function fadeTo(target, ms = 800) {
    const start = music.volume;
    const t0 = performance.now();
    return new Promise(resolve => {
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        music.volume = start + (target - start) * k;
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  async function playMusic() {
    if (!music.querySelector('source').src || music.querySelector('source').getAttribute('src') === '') return;
    music.volume = 0;
    try {
      await music.play();
      setIcon(true);
      await fadeTo(TARGET_VOLUME);
    } catch (_) { /* нет файла или браузер заблокировал */ }
  }
  async function pauseMusic() {
    await fadeTo(0, 500);
    music.pause();
    setIcon(false);
  }

  musicBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (music.paused) playMusic(); else pauseMusic();
  });

  // первый тап в любом месте → старт музыки + скрытие подсказки
  function firstGesture() {
    if (started) return;
    started = true;
    if (hint) hint.classList.add('is-hidden');
    setTimeout(() => hint && hint.remove(), 600);
    playMusic();
  }
  ['click', 'touchstart', 'keydown'].forEach(ev =>
    addEventListener(ev, firstGesture, { once: true, passive: true }));

  // если файла нет — кнопку прячем, подсказку убираем
  music.addEventListener('error', () => {
    musicBtn.style.display = 'none';
    if (hint) hint.remove();
  }, { once: true });
})();
