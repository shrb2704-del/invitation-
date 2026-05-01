(async () => {
  'use strict';

  const env = document.getElementById('env');
  const seal = document.getElementById('seal');
  const card = document.getElementById('card');
  const openBtn = document.getElementById('openCard');
  const backBtn = document.getElementById('backBtn');
  const hint = document.getElementById('hint');
  const nameEl = document.getElementById('guestName');

  // ===== guest name =====
  const params = new URLSearchParams(location.search);
  const guestId = params.get('n');
  const explicit = params.get('name');
  let guestName = null;
  if (explicit) guestName = decodeURIComponent(explicit);
  else if (guestId) {
    try {
      const r = await fetch('guests.json', { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        if (data && data[guestId]) guestName = data[guestId];
      }
    } catch (_) {}
  }
  if (guestName) {
    nameEl.textContent = guestName;
  } else {
    // нет имени — прячем только строку с именем, но «Дорогие родители!» оставляем
    nameEl.style.display = 'none';
  }

  // ===== ХОРЕОГРАФИЯ =====
  // 1. Тап → клапан открывается
  // 2. Открытка проявляется внутри конверта (маленькая)
  // 3. Открытка вылезает наверх и растёт до полного размера
  // 4. Конверт уходит вниз
  let phase = 0;
  function openEnvelope() {
    if (phase > 0) return;
    phase = 1;
    if (hint) { hint.classList.add('is-hidden'); setTimeout(() => hint.remove(), 500); }

    env.classList.add('is-open');
    // открытка проявляется как только клапан начал открываться
    setTimeout(() => card.classList.add('is-emerging'), 350);
    // открытка вылетает и принимает полный размер
    setTimeout(() => card.classList.add('is-out'), 1100);
    // конверт прячется
    setTimeout(() => env.classList.add('is-gone'), 1500);

    // праздничный салют сверху
    if (window.__fxBurst) {
      setTimeout(() => window.__fxBurst(innerWidth * 0.5, innerHeight * 0.35, 6), 1100);
    }

    startMusic();
  }

  seal.addEventListener('click', (e) => { e.stopPropagation(); openEnvelope(); });
  env.addEventListener('click', openEnvelope);
  env.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); }
  });

  // ===== FLIP / BACK =====
  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    card.classList.add('is-flipped');
  });
  backBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    card.classList.remove('is-flipped');
  });

  // ===== RSVP =====
  const rsvpBtns = document.getElementById('rsvpBtns');
  const nameInput = document.getElementById('nameInput');
  const wish = document.getElementById('wish');
  const send = document.getElementById('send');
  const status = document.getElementById('status');
  let chosen = null;

  // Если имя пришло из URL/guests.json — поле имени не нужно
  const needsName = !guestName;

  rsvpBtns.addEventListener('click', (e) => {
    const b = e.target.closest('.b[data-answer]');
    if (!b) return;
    chosen = b.dataset.answer;
    rsvpBtns.querySelectorAll('.b').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    if (needsName) nameInput.hidden = false;
    wish.hidden = false;
    send.hidden = false;
    setTimeout(() => (needsName ? nameInput : wish).focus({ preventScroll: false }), 50);
  });

  nameInput.addEventListener('input', () => nameInput.classList.remove('is-error'));

  send.addEventListener('click', async () => {
    if (!chosen) return;
    let finalName = guestName;
    if (needsName) {
      finalName = (nameInput.value || '').trim();
      if (finalName.length < 2) {
        nameInput.classList.add('is-error');
        nameInput.focus();
        status.className = 'rsvp__status error';
        status.textContent = 'Пожалуйста, укажите Ваше имя.';
        return;
      }
    }
    send.disabled = true;
    status.className = 'rsvp__status';
    status.textContent = 'Отправляем…';
    const payload = {
      answer: chosen,
      name: finalName || 'Гость без имени',
      guestId: guestId || null,
      wish: (wish.value || '').trim().slice(0, 500),
      ts: new Date().toISOString(),
      ua: navigator.userAgent,
    };
    const isPreview = /\.github\.io$/.test(location.hostname) || location.protocol === 'file:';
    try {
      if (isPreview) {
        await new Promise(r => setTimeout(r, 600));
      } else {
        const res = await fetch('/.netlify/functions/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      }
      status.classList.add('success');
      status.textContent = chosen === 'yes' ? 'Спасибо! Ждём вас ✨' : 'Спасибо за ответ.';
      wish.disabled = true;
      if (needsName) nameInput.disabled = true;
      if (chosen === 'yes' && window.__fxBurst) {
        window.__fxBurst(innerWidth * 0.5, innerHeight * 0.4, 8);
      }
    } catch (_) {
      status.classList.add('error');
      status.textContent = 'Не удалось отправить.';
      send.disabled = false;
    }
  });

  // ===== DUST PARTICLES (поверх шейдера, золотая пыль) =====
  const cvs = document.getElementById('dust');
  const ctx = cvs.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W, H, particles = [];
  function resize() {
    W = cvs.width = innerWidth * DPR;
    H = cvs.height = innerHeight * DPR;
    cvs.style.width = innerWidth + 'px'; cvs.style.height = innerHeight + 'px';
  }
  function spawn() {
    particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: (Math.random() * 1.4 + 0.4) * DPR,
      vy: (Math.random() * 0.25 + 0.06) * DPR,
      vx: (Math.random() - 0.5) * 0.15 * DPR,
      a: Math.random() * 0.5 + 0.2,
      ph: Math.random() * Math.PI * 2,
    }));
  }
  function tick(t) {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx + Math.sin(t / 1000 + p.ph) * 0.15;
      p.y += p.vy;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      grd.addColorStop(0, `rgba(255,235,180,${p.a})`);
      grd.addColorStop(1, 'rgba(255,235,180,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  resize(); spawn();
  addEventListener('resize', () => { resize(); spawn(); });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(tick);

  // ===== MUSIC =====
  const music = document.getElementById('bgMusic');
  let musicStarted = false;
  async function startMusic() {
    if (musicStarted) return;
    musicStarted = true;
    try {
      music.volume = 0;
      await music.play();
      const t0 = performance.now();
      (function fade() {
        const k = Math.min(1, (performance.now() - t0) / 1400);
        music.volume = k * 0.32;
        if (k < 1) requestAnimationFrame(fade);
      })();
    } catch (_) {}
  }
})();
