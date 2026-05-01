// 3D twinkling starfield (Three.js).
// Mounts onto canvas#bgShader.

(function () {
  'use strict';
  const canvas = document.getElementById('bgShader');
  if (!canvas) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof THREE === 'undefined') {
    console.warn('Three.js not loaded');
    return;
  }

  const COUNT = 1500;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, 0);

  // ===== Generate star data =====
  const positions = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const twinkleSpeeds = new Float32Array(COUNT);
  const twinkleOffsets = new Float32Array(COUNT);
  const colors = new Float32Array(COUNT * 3);
  const DIST = 40;
  const tmpColor = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    // равномерно распределить точки по сфере (тот же алгоритм, что в исходнике)
    const theta = THREE.MathUtils.randFloatSpread(360);
    const phi = THREE.MathUtils.randFloatSpread(360);
    positions[i * 3 + 0] = DIST * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = DIST * Math.sin(theta) * Math.sin(phi);
    positions[i * 3 + 2] = DIST * Math.cos(theta);

    const sizeRand = Math.random();
    if (sizeRand > 0.95) sizes[i] = Math.random() * 4 + 3;
    else if (sizeRand > 0.8) sizes[i] = Math.random() * 2 + 1.5;
    else sizes[i] = Math.random() * 1 + 0.5;

    twinkleSpeeds[i] = Math.random() * 2 + 0.5;
    twinkleOffsets[i] = Math.random();

    const colorRand = Math.random();
    if (colorRand > 0.9) {
      // warm (gold/amber)
      tmpColor.setHSL(0.1 + Math.random() * 0.1, 0.6, 0.9);
    } else if (colorRand > 0.7) {
      // cool (slight blue tint)
      tmpColor.setHSL(0.55 + Math.random() * 0.1, 0.3, 0.95);
    } else {
      // white
      tmpColor.setHSL(0, 0, 0.9 + Math.random() * 0.1);
    }
    colors[i * 3 + 0] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('twinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
  geo.setAttribute('twinkleOffset', new THREE.BufferAttribute(twinkleOffsets, 1));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      pixelRatio: { value: dpr }
    },
    vertexShader: `
      attribute float size;
      attribute float twinkleSpeed;
      attribute float twinkleOffset;
      attribute vec3 color;
      varying float vOpacity;
      varying vec3 vColor;
      uniform float time;
      uniform float pixelRatio;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float distance = length(mvPosition.xyz);
        gl_PointSize = size * pixelRatio * (400.0 / distance);
        gl_Position = projectionMatrix * mvPosition;
        float twinkle = sin(time * twinkleSpeed + twinkleOffset * 6.28318) * 0.5 + 0.5;
        float pulse = sin(time * 0.5 + twinkleOffset) * 0.1 + 0.9;
        vOpacity = twinkle * pulse * 0.7 + 0.3;
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;
        float intensity = 1.0 - smoothstep(0.0, 0.5, dist);
        intensity = pow(intensity, 1.5);
        float sparkle = max(
          smoothstep(0.48, 0.3, abs(center.x)),
          smoothstep(0.48, 0.3, abs(center.y))
        ) * 0.3;
        intensity += sparkle;
        gl_FragColor = vec4(vColor, intensity * vOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  }
  addEventListener('resize', resize);

  let raf, t0 = performance.now(), running = true, lastTick = t0;
  function loop(now) {
    if (!running) return;
    const delta = (now - lastTick) * 1e-3;
    lastTick = now;
    mat.uniforms.time.value += delta;
    points.rotation.y += delta * 0.01;
    points.rotation.x += delta * 0.005;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { lastTick = performance.now(); raf = requestAnimationFrame(loop); }
    else cancelAnimationFrame(raf);
  });

  // плавно проявить
  requestAnimationFrame(() => canvas.classList.add('is-on'));
})();
