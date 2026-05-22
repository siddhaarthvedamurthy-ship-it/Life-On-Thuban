/* ============================================================
   PROJECT THUBAN — APP.JS
   Three.js Holographic Viewport · Magnetospheric Flux Simulator
   Tab Navigation · Form-Shift Controller · Live Metrics
   ============================================================ */

'use strict';

/* ── Globals ── */
let currentTab   = 'tab-architecture';
let currentHolo  = 'stellar';
let isPlasmaMode = false;
let seedLaunchCount = 0;

/* ──────────────────────────────────────────────────────────
   SECTION 1: TAB NAVIGATION
────────────────────────────────────────────────────────── */
function initTabs() {
  const tabs   = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected','true');
      document.getElementById(targetId).classList.add('active');
      currentTab = targetId;

      // Lazy-init flux simulator on first visit
      if (targetId === 'tab-flux' && !fluxInitialized) {
        initFluxSimulator();
      }
    });
  });
}

/* ──────────────────────────────────────────────────────────
   SECTION 2: THREE.JS HOLOGRAPHIC VIEWPORT
────────────────────────────────────────────────────────── */
let threeScene, threeCamera, threeRenderer, threeAnimId;
let hologramGroup, particleSystem;
let mouseDown = false, lastMouse = { x: 0, y: 0 };
let crystalGeometries = {};

const COLORS = {
  saffron:  0xFF9933,
  crimson:  0x990000,
  gold:     0xFFD700,
  lavender: 0xE6E6FA,
  ochre:    0xD9A05B,
  cream:    0xF4F1EA
};

function initThreeJS() {
  const canvas    = document.getElementById('threeCanvas');
  const container = canvas.parentElement;

  threeScene = new THREE.Scene();
  threeScene.background = null;

  threeCamera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
  threeCamera.position.set(0, 0, 5);

  threeRenderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
  });
  threeRenderer.setClearColor(0x000000, 0);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeRenderer.setSize(container.clientWidth, container.clientHeight);

  /* Lights */
  const ambient = new THREE.AmbientLight(0xFF9933, 0.3);
  threeScene.add(ambient);

  const pointA = new THREE.PointLight(0xFF9933, 1.8, 20);
  pointA.position.set(3, 3, 3);
  threeScene.add(pointA);

  const pointB = new THREE.PointLight(0xE6E6FA, 1.2, 20);
  pointB.position.set(-3, -2, 2);
  threeScene.add(pointB);

  const pointC = new THREE.PointLight(0xFFD700, 0.8, 15);
  pointC.position.set(0, 4, -2);
  threeScene.add(pointC);

  hologramGroup = new THREE.Group();
  threeScene.add(hologramGroup);

  buildHologram('stellar');
  bindThreeControls(canvas);
  bindHoloButtons();
  bindFormShifter();

  threeAnimId = requestAnimationFrame(animateThree);

  /* Resize handler */
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    threeCamera.aspect = w / h;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(w, h);
  });
}

/* ── Hologram Builder ── */
function buildHologram(type) {
  /* Clear current scene objects */
  while (hologramGroup.children.length > 0) {
    const obj = hologramGroup.children[0];
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
    hologramGroup.remove(obj);
  }
  if (particleSystem) {
    if (particleSystem.geometry) particleSystem.geometry.dispose();
    if (particleSystem.material) particleSystem.material.dispose();
    threeScene.remove(particleSystem);
    particleSystem = null;
  }

  currentHolo = type;
  document.getElementById('modeIndicator').textContent =
    (isPlasmaMode ? 'PLASMA STATE' : 'SOLID STATE') + ' · ' + type.toUpperCase();

  if (isPlasmaMode) {
    buildPlasmaCloud(type);
  } else {
    buildCrystalHologram(type);
  }
}

function makeMat(color, opacity) {
  return new THREE.MeshPhongMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: opacity || 0.25,
    wireframe: false,
    side: THREE.DoubleSide
  });
}

function makeWireMat(color) {
  return new THREE.MeshBasicMaterial({
    color: color,
    wireframe: true,
    transparent: true,
    opacity: 0.55
  });
}

function addGlowRing(radius, color, y) {
  const geo = new THREE.TorusGeometry(radius, 0.02, 8, 64);
  const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  if (y !== undefined) mesh.position.y = y;
  hologramGroup.add(mesh);
}

/* ── Crystal Hologram Switcher ── */
function buildCrystalHologram(type) {
  switch (type) {
    case 'stellar':    buildStellarHolo();    break;
    case 'male':       buildMaleHolo();       break;
    case 'connector':  buildConnectorHolo();  break;
    case 'female1':    buildFemale1Holo();    break;
    case 'female2':    buildFemale2Holo();    break;
    case 'female3':    buildFemale3Holo();    break;
    case 'producer':   buildProducerHolo();   break;
    default:           buildStellarHolo();
  }
}

/* ── Stellar System Hologram ── */
function buildStellarHolo() {
  /* Core star */
  const coreGeo = new THREE.IcosahedronGeometry(0.6, 2);
  const coreMat = new THREE.MeshPhongMaterial({
    color: COLORS.saffron, emissive: COLORS.saffron, emissiveIntensity: 0.6,
    transparent: true, opacity: 0.45, wireframe: false, side: THREE.DoubleSide
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  hologramGroup.add(core);

  const coreWire = new THREE.Mesh(coreGeo.clone(), makeWireMat(COLORS.gold));
  hologramGroup.add(coreWire);

  /* Dyson shells */
  const shellRadii = [1.0, 1.55, 2.1, 2.65];
  const shellColors = [COLORS.saffron, COLORS.ochre, COLORS.lavender, COLORS.gold];
  shellRadii.forEach((r, i) => {
    const sGeo = new THREE.IcosahedronGeometry(r, 1);
    const sMat = new THREE.MeshPhongMaterial({
      color: shellColors[i], emissive: shellColors[i], emissiveIntensity: 0.2,
      transparent: true, opacity: 0.12, side: THREE.DoubleSide
    });
    hologramGroup.add(new THREE.Mesh(sGeo, sMat));

    const wGeo = new THREE.IcosahedronGeometry(r, 1);
    hologramGroup.add(new THREE.Mesh(wGeo, makeWireMat(shellColors[i])));

    addGlowRing(r, shellColors[i]);
  });

  /* Flux tube lines */
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const pts = [];
    for (let t = 0; t <= 40; t++) {
      const a = angle + (t / 40) * 0.5;
      const radVar = 0.7 + (t / 40) * 2.0;
      pts.push(new THREE.Vector3(
        Math.cos(a) * radVar,
        (t / 40 - 0.5) * 3,
        Math.sin(a) * radVar
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.012, 4, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: COLORS.lavender, transparent: true, opacity: 0.5 });
    hologramGroup.add(new THREE.Mesh(tubeGeo, tubeMat));
  }
}

/* ── Male Hologram: Long-axis dipolar ── */
function buildMaleHolo() {
  /* Elongated octahedron body */
  const geo = new THREE.OctahedronGeometry(1.0, 0);
  geo.scale(0.7, 1.6, 0.7);
  hologramGroup.add(new THREE.Mesh(geo, makeMat(COLORS.saffron)));
  hologramGroup.add(new THREE.Mesh(geo.clone(), makeWireMat(COLORS.gold)));

  /* Dipole axis */
  const axisGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8);
  const axisMat = new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.8 });
  hologramGroup.add(new THREE.Mesh(axisGeo, axisMat));

  /* Dipole rings */
  [-1.4, 0, 1.4].forEach(y => addGlowRing(0.9, COLORS.saffron, y));

  /* Energy projection cone */
  const coneGeo = new THREE.ConeGeometry(0.5, 1.2, 8);
  coneGeo.translate(0, 1.9, 0);
  const coneMat = makeMat(COLORS.crimson, 0.3);
  hologramGroup.add(new THREE.Mesh(coneGeo, coneMat));
  const coneWire = new THREE.Mesh(coneGeo.clone(), makeWireMat(COLORS.saffron));
  hologramGroup.add(coneWire);
}

/* ── Connector Hologram: Multi-polar 6-null topology ── */
function buildConnectorHolo() {
  /* Central icosahedron */
  const cGeo = new THREE.IcosahedronGeometry(0.7, 1);
  hologramGroup.add(new THREE.Mesh(cGeo, makeMat(COLORS.lavender)));
  hologramGroup.add(new THREE.Mesh(cGeo.clone(), makeWireMat(COLORS.cream)));

  /* 6 field-null arms at hexagonal angles */
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const armDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

    const pts = [
      new THREE.Vector3(0, 0, 0),
      armDir.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.3, 0)),
      armDir.clone().multiplyScalar(1.2).add(new THREE.Vector3(0, 0, 0))
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.04, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: COLORS.lavender, transparent: true, opacity: 0.7 });
    hologramGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

    /* Null-point spheres */
    const nullGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const nullMesh = new THREE.Mesh(nullGeo, makeMat(COLORS.gold, 0.5));
    nullMesh.position.copy(armDir.clone().multiplyScalar(1.2));
    hologramGroup.add(nullMesh);
  }

  addGlowRing(1.4, COLORS.lavender, 0);
  addGlowRing(0.9, COLORS.cream, 0);
}

/* ── Female I Hologram: Fluid-stream crystal ── */
function buildFemale1Holo() {
  const geo = new THREE.SphereGeometry(0.85, 16, 16);
  hologramGroup.add(new THREE.Mesh(geo, makeMat(COLORS.gold)));
  hologramGroup.add(new THREE.Mesh(geo.clone(), makeWireMat(COLORS.gold)));

  /* Fluid stream rings */
  for (let i = 0; i < 5; i++) {
    const r = 0.5 + i * 0.35;
    const ringGeo = new THREE.TorusGeometry(r, 0.03, 8, 64);
    ringGeo.rotateX(Math.PI / 2 + (i * 0.3));
    ringGeo.rotateY(i * 0.4);
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.saffron, transparent: true, opacity: 0.6 - i * 0.08 });
    hologramGroup.add(new THREE.Mesh(ringGeo, ringMat));
  }

  /* Inner crystal lattice */
  const latGeo = new THREE.OctahedronGeometry(0.5, 2);
  hologramGroup.add(new THREE.Mesh(latGeo, makeWireMat(COLORS.cream)));
}

/* ── Female II Hologram: Interlocking crystal matrix ── */
function buildFemale2Holo() {
  /* Nested cube-octahedra compound */
  const offsets = [
    [0,0,0], [0.7,0.7,0], [-0.7,0.7,0], [0.7,-0.7,0],
    [-0.7,-0.7,0], [0,0,0.9], [0,0,-0.9]
  ];
  offsets.forEach((pos, i) => {
    const size = i === 0 ? 0.6 : 0.38;
    const geo = new THREE.BoxGeometry(size, size, size);
    geo.translate(pos[0], pos[1], pos[2]);
    const mat = makeMat(COLORS.ochre, 0.2);
    hologramGroup.add(new THREE.Mesh(geo, mat));
    hologramGroup.add(new THREE.Mesh(geo.clone(), makeWireMat(COLORS.saffron)));
  });

  /* Binding force lines */
  offsets.slice(1).forEach(pos => {
    const pts = [new THREE.Vector3(0,0,0), new THREE.Vector3(...pos)];
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.025, 4, false);
    hologramGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0.5 })));
  });
}

/* ── Female III Hologram: Energetic hub ── */
function buildFemale3Holo() {
  /* Central torus */
  const torusGeo = new THREE.TorusGeometry(1.0, 0.28, 16, 64);
  hologramGroup.add(new THREE.Mesh(torusGeo, makeMat(COLORS.crimson)));
  hologramGroup.add(new THREE.Mesh(torusGeo.clone(), makeWireMat(COLORS.saffron)));

  /* Inner sphere */
  const sGeo = new THREE.SphereGeometry(0.45, 16, 16);
  hologramGroup.add(new THREE.Mesh(sGeo, makeMat(COLORS.gold, 0.4)));
  hologramGroup.add(new THREE.Mesh(sGeo.clone(), makeWireMat(COLORS.gold)));

  /* Energy spokes */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0)
    ];
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.02, 4, false);
    hologramGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLORS.crimson, transparent: true, opacity: 0.6 })));
  }

  addGlowRing(1.3, COLORS.saffron, 0);
}

/* ── Producer Hologram: Compressed PKS form ── */
function buildProducerHolo() {
  /* Outer dodecahedron cage */
  const outGeo = new THREE.DodecahedronGeometry(1.3, 0);
  hologramGroup.add(new THREE.Mesh(outGeo, makeMat(COLORS.crimson, 0.1)));
  hologramGroup.add(new THREE.Mesh(outGeo.clone(), makeWireMat(COLORS.saffron)));

  /* Inner icosahedron */
  const innGeo = new THREE.IcosahedronGeometry(0.65, 1);
  hologramGroup.add(new THREE.Mesh(innGeo, makeMat(COLORS.ochre, 0.3)));
  hologramGroup.add(new THREE.Mesh(innGeo.clone(), makeWireMat(COLORS.gold)));

  /* Compression rings */
  [0.4, 0.7, 1.0, 1.25].forEach((r, i) => addGlowRing(r, i % 2 === 0 ? COLORS.crimson : COLORS.saffron, 0));

  /* Central seed */
  const seedGeo = new THREE.SphereGeometry(0.18, 16, 16);
  const seedMat = new THREE.MeshPhongMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 1, transparent: true, opacity: 0.9 });
  hologramGroup.add(new THREE.Mesh(seedGeo, seedMat));
}

/* ── Plasma Cloud Mode ── */
function buildPlasmaCloud(type) {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);

  const palettes = {
    stellar:   [[1.0, 0.6, 0.2], [1.0, 0.85, 0.0]],
    male:      [[1.0, 0.6, 0.2], [0.6, 0.0, 0.0]],
    connector: [[0.9, 0.9, 0.98], [0.85, 0.65, 0.35]],
    female1:   [[1.0, 0.85, 0.0], [1.0, 0.6, 0.2]],
    female2:   [[0.85, 0.63, 0.36], [1.0, 0.6, 0.2]],
    female3:   [[0.6, 0.0, 0.0], [1.0, 0.6, 0.2]],
    producer:  [[0.6, 0.0, 0.0], [1.0, 0.85, 0.0]]
  };

  const pal = palettes[type] || palettes.stellar;

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 0.5 + Math.random() * 1.8;

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const c = pal[Math.floor(Math.random() * pal.length)];
    colors[i * 3]     = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.75
  });

  particleSystem = new THREE.Points(geo, mat);
  threeScene.add(particleSystem);

  /* Confinement bubble */
  const bubbleGeo = new THREE.SphereGeometry(2.0, 24, 24);
  const bubbleMat = new THREE.MeshBasicMaterial({
    color: COLORS.lavender,
    wireframe: true,
    transparent: true,
    opacity: 0.12
  });
  hologramGroup.add(new THREE.Mesh(bubbleGeo, bubbleMat));
}

/* ── Three.js Animation Loop ── */
function animateThree() {
  threeAnimId = requestAnimationFrame(animateThree);

  const t = performance.now() * 0.0005;

  if (hologramGroup) {
    hologramGroup.rotation.y = t * 0.4;
    hologramGroup.rotation.x = Math.sin(t * 0.25) * 0.18;
  }

  if (particleSystem) {
    particleSystem.rotation.y = -t * 0.2;
    particleSystem.rotation.z = Math.sin(t * 0.18) * 0.12;
    const positions = particleSystem.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += Math.sin(t + i) * 0.0005;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
  }

  threeRenderer.render(threeScene, threeCamera);
}

/* ── Mouse / Pointer Controls ── */
function bindThreeControls(canvas) {
  canvas.addEventListener('mousedown', e => {
    mouseDown = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener('mouseup',  () => { mouseDown = false; });
  document.addEventListener('mousemove', e => {
    if (!mouseDown) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    if (hologramGroup) {
      hologramGroup.rotation.y += dx * 0.012;
      hologramGroup.rotation.x += dy * 0.012;
    }
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('wheel', e => {
    threeCamera.position.z = Math.max(1.5, Math.min(12, threeCamera.position.z + e.deltaY * 0.01));
    e.preventDefault();
  }, { passive: false });

  /* Touch support */
  let lastTouch = null;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && lastTouch) {
      const dx = e.touches[0].clientX - lastTouch.x;
      const dy = e.touches[0].clientY - lastTouch.y;
      if (hologramGroup) {
        hologramGroup.rotation.y += dx * 0.015;
        hologramGroup.rotation.x += dy * 0.015;
      }
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });
}

/* ── Hologram Mode Buttons ── */
function bindHoloButtons() {
  const btns = document.querySelectorAll('.holo-btn[data-holo]');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      buildHologram(btn.dataset.holo);
    });
  });
}

/* ── Form Shifter (Solid ↔ Plasma) ── */
function bindFormShifter() {
  const btn = document.getElementById('btn-toggle-state');
  if (!btn) return;
  btn.addEventListener('click', () => {
    isPlasmaMode = !isPlasmaMode;
    btn.classList.toggle('active', isPlasmaMode);
    btn.textContent = isPlasmaMode ? '⬡ Molecular Config: PLASMA' : 'Toggle Molecular Configuration';
    document.getElementById('modeIndicator').textContent =
      (isPlasmaMode ? 'PLASMA STATE' : 'SOLID STATE') + ' · ' + currentHolo.toUpperCase();
    buildHologram(currentHolo);
  });
}

/* ──────────────────────────────────────────────────────────
   SECTION 3: FLUX SIMULATOR (Canvas 2D)
────────────────────────────────────────────────────────── */
let fluxCanvas2D, fluxCtx, fluxAnimId;
let fluxInitialized = false;
let fluxParticles   = [];
let seedNodes       = [];
let fluxRange       = 50;
let seedPower       = 75;
let coherence       = 60;

function initFluxSimulator() {
  fluxInitialized = true;
  fluxCanvas2D = document.getElementById('fluxCanvas');
  fluxCtx      = fluxCanvas2D.getContext('2d');

  resizeFlux();
  window.addEventListener('resize', resizeFlux);

  initFluxParticles();
  updateMetrics();
  animateFlux();
  bindFluxControls();
}

function resizeFlux() {
  const wrapper = fluxCanvas2D.parentElement;
  fluxCanvas2D.width  = wrapper.clientWidth;
  fluxCanvas2D.height = wrapper.clientHeight;
}

/* ── Flux Particle Pool ── */
function initFluxParticles() {
  fluxParticles = [];
  const count = 140;
  for (let i = 0; i < count; i++) {
    fluxParticles.push(createFluxParticle());
  }
}

function createFluxParticle() {
  const w = fluxCanvas2D.width;
  const h = fluxCanvas2D.height;
  const cx = w / 2, cy = h / 2;
  const angle = Math.random() * Math.PI * 2;
  const radius = 20 + Math.random() * Math.min(cx, cy) * 0.85;
  return {
    x: cx + Math.cos(angle) * radius * 0.1,
    y: cy + Math.sin(angle) * radius * 0.1,
    vx: Math.cos(angle + Math.PI / 2) * (0.5 + Math.random() * 1.5),
    vy: Math.sin(angle + Math.PI / 2) * (0.5 + Math.random() * 1.5),
    life: Math.random(),
    maxLife: 0.6 + Math.random() * 0.4,
    radius: radius,
    angle: angle,
    speed: 0.008 + Math.random() * 0.012,
    color: Math.random() < 0.6 ? '#FF9933' : (Math.random() < 0.5 ? '#FFD700' : '#E6E6FA'),
    size: 1 + Math.random() * 2.5
  };
}

/* ── Seed Node ── */
function createSeedNode() {
  const w  = fluxCanvas2D.width;
  const h  = fluxCanvas2D.height;
  const cx = w / 2, cy = h / 2;
  const power = seedPower / 100;

  return {
    x: cx, y: cy,
    life: 0,
    maxLife: 280 + power * 180,
    color: '#FF9933',
    size: 4 + power * 8,
    trail: [],
    angle: Math.random() * Math.PI * 2,
    speed: 1.5 + power * 3.5,
    controlX: cx + (Math.random() - 0.5) * w * 0.6,
    controlY: cy + (Math.random() - 0.5) * h * 0.6,
    endX: cx + (Math.random() < 0.5 ? -1 : 1) * (w * 0.4 + Math.random() * w * 0.1),
    endY: cy + (Math.random() - 0.5) * h * 0.3
  };
}

/* ── Flux Field Lines ── */
function drawFluxField() {
  const w  = fluxCanvas2D.width;
  const h  = fluxCanvas2D.height;
  const cx = w / 2, cy = h / 2;
  const t  = performance.now() * 0.0006;
  const fr = fluxRange / 100;
  const co = coherence / 100;

  const lineCount = Math.floor(6 + fr * 12);
  for (let i = 0; i < lineCount; i++) {
    const baseAngle = (i / lineCount) * Math.PI * 2 + t * 0.2;
    const maxR = Math.min(cx, cy) * (0.5 + fr * 0.45);

    fluxCtx.beginPath();
    for (let s = 0; s <= 60; s++) {
      const r = (s / 60) * maxR;
      const wobble = co < 0.7 ? Math.sin(t * 3 + s * 0.3 + i) * (1 - co) * 18 : 0;
      const a = baseAngle + (s / 60) * 0.8 + wobble * 0.02;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      s === 0 ? fluxCtx.moveTo(x, y) : fluxCtx.lineTo(x, y);
    }

    const grad = fluxCtx.createLinearGradient(cx, cy, cx + Math.cos(baseAngle) * maxR, cy + Math.sin(baseAngle) * maxR);
    const alpha = (0.15 + fr * 0.25) * co;
    grad.addColorStop(0, `rgba(255,153,51,${alpha})`);
    grad.addColorStop(0.5, `rgba(255,215,0,${alpha * 0.6})`);
    grad.addColorStop(1, `rgba(230,230,250,0)`);
    fluxCtx.strokeStyle = grad;
    fluxCtx.lineWidth = 0.5 + fr * 1.2;
    fluxCtx.stroke();
  }
}

/* ── Core Glow ── */
function drawCore() {
  const w  = fluxCanvas2D.width;
  const h  = fluxCanvas2D.height;
  const cx = w / 2, cy = h / 2;
  const t  = performance.now() * 0.001;
  const pulse = 1 + Math.sin(t * 2) * 0.08;

  const radii  = [90, 50, 28, 12];
  const alphas = [0.06, 0.12, 0.22, 0.55];
  const clrs   = ['255,153,51','255,215,0','255,153,51','255,215,0'];

  radii.forEach((r, i) => {
    const grad = fluxCtx.createRadialGradient(cx, cy, 0, cx, cy, r * pulse);
    grad.addColorStop(0,   `rgba(${clrs[i]},${alphas[i]})`);
    grad.addColorStop(1,   `rgba(${clrs[i]},0)`);
    fluxCtx.beginPath();
    fluxCtx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
    fluxCtx.fillStyle = grad;
    fluxCtx.fill();
  });

  /* Core ring */
  fluxCtx.beginPath();
  fluxCtx.arc(cx, cy, 12 * pulse, 0, Math.PI * 2);
  fluxCtx.strokeStyle = `rgba(255,215,0,0.85)`;
  fluxCtx.lineWidth = 1.5;
  fluxCtx.stroke();
}

/* ── Flux Particles ── */
function updateDrawParticles() {
  const w = fluxCanvas2D.width, h = fluxCanvas2D.height;
  const cx = w / 2, cy = h / 2;
  const t = performance.now() * 0.0008;

  fluxParticles.forEach(p => {
    p.angle += p.speed * (0.5 + fluxRange / 100);
    const wobble = (1 - coherence / 100) * Math.sin(t * 5 + p.angle * 3) * 15;
    p.x = cx + Math.cos(p.angle) * (p.radius + wobble);
    p.y = cy + Math.sin(p.angle) * (p.radius + wobble);
    p.life = Math.min(p.life + 0.004, p.maxLife);

    const alpha = Math.min(p.life / 0.1, 1) * Math.min((p.maxLife - p.life) / 0.1, 1) * 0.7;
    fluxCtx.beginPath();
    fluxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    fluxCtx.fillStyle = p.color.replace(')', `,${alpha})`).replace('rgb', 'rgba').replace('#FF9933', `rgba(255,153,51,${alpha})`).replace('#FFD700', `rgba(255,215,0,${alpha})`).replace('#E6E6FA', `rgba(230,230,250,${alpha})`);
    fluxCtx.fill();

    if (p.life >= p.maxLife) Object.assign(p, createFluxParticle());
  });
}

/* ── Seed Nodes ── */
function updateDrawSeeds() {
  seedNodes = seedNodes.filter(s => s.life < s.maxLife);
  seedNodes.forEach(s => {
    s.life++;
    const prog = s.life / s.maxLife;
    const t2   = prog * prog;
    s.x = (1-t2)*(1-t2)*fluxCanvas2D.width/2 + 2*(1-t2)*t2*s.controlX + t2*t2*s.endX;
    s.y = (1-t2)*(1-t2)*fluxCanvas2D.height/2 + 2*(1-t2)*t2*s.controlY + t2*t2*s.endY;

    s.trail.push({ x: s.x, y: s.y, a: 1 - prog * 0.5 });
    if (s.trail.length > 60) s.trail.shift();

    /* Draw trail */
    for (let i = 1; i < s.trail.length; i++) {
      const ta = s.trail[i].a * (i / s.trail.length) * 0.7;
      fluxCtx.beginPath();
      fluxCtx.moveTo(s.trail[i-1].x, s.trail[i-1].y);
      fluxCtx.lineTo(s.trail[i].x, s.trail[i].y);
      fluxCtx.strokeStyle = `rgba(255,215,0,${ta})`;
      fluxCtx.lineWidth = 1.5 + (i / s.trail.length) * s.size * 0.3;
      fluxCtx.stroke();
    }

    /* Draw seed node */
    const alpha = Math.max(0, 1 - prog * 1.2);
    const pulse = 1 + Math.sin(s.life * 0.25) * 0.2;
    fluxCtx.beginPath();
    fluxCtx.arc(s.x, s.y, s.size * pulse, 0, Math.PI * 2);
    const grad = fluxCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * pulse);
    grad.addColorStop(0, `rgba(255,215,0,${alpha})`);
    grad.addColorStop(0.5, `rgba(255,153,51,${alpha * 0.7})`);
    grad.addColorStop(1, `rgba(153,0,0,0)`);
    fluxCtx.fillStyle = grad;
    fluxCtx.fill();
  });
}

/* ── Flux Animation Loop ── */
function animateFlux() {
  fluxAnimId = requestAnimationFrame(animateFlux);
  if (!fluxCanvas2D) return;

  fluxCtx.clearRect(0, 0, fluxCanvas2D.width, fluxCanvas2D.height);

  drawFluxField();
  drawCore();
  updateDrawParticles();
  updateDrawSeeds();

  /* Subtle scanline overlay */
  fluxCtx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let y = 0; y < fluxCanvas2D.height; y += 4) {
    fluxCtx.fillRect(0, y, fluxCanvas2D.width, 1);
  }

  /* Dynamic metric refresh */
  if (Math.random() < 0.02) updateMetrics();
}

/* ── Flux Controls Binding ── */
function bindFluxControls() {
  const sliders = [
    { id: 'fluxRange',  display: 'fluxRangeDisplay',  variable: 'fluxRange'  },
    { id: 'seedPower',  display: 'seedPowerDisplay',   variable: 'seedPower'  },
    { id: 'coherence',  display: 'coherenceDisplay',   variable: 'coherence'  }
  ];

  sliders.forEach(s => {
    const el  = document.getElementById(s.id);
    const dis = document.getElementById(s.display);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = parseInt(el.value);
      if (s.variable === 'fluxRange')  fluxRange  = v;
      if (s.variable === 'seedPower')  seedPower  = v;
      if (s.variable === 'coherence')  coherence  = v;
      if (dis) dis.textContent = v + '%';
      el.style.setProperty('--val', v + '%');
      updateMetrics();
    });
    el.style.setProperty('--val', el.value + '%');
  });

  const seedBtn = document.getElementById('btn-compress-seed');
  if (seedBtn) {
    seedBtn.addEventListener('click', () => {
      /* Launch seed */
      const node = createSeedNode();
      seedNodes.push(node);
      seedLaunchCount++;

      /* Update log */
      const log = document.getElementById('seedLog');
      if (log) {
        const now = new Date().toLocaleTimeString();
        const power = seedPower.toFixed(0);
        const velocity = (0.003 + (seedPower / 100) * 0.009).toFixed(4);
        const entry = document.createElement('div');
        entry.style.cssText = 'color:var(--saffron);border-bottom:1px solid rgba(255,153,51,0.15);padding:0.2rem 0;';
        entry.innerHTML = `<span style="color:var(--gold);">[${seedLaunchCount.toString().padStart(3,'0')}]</span> ${now} · Power <span style="color:var(--ochre);">${power}%</span> · v = <span style="color:var(--gold);">${velocity}c</span>`;
        const placeholder = log.querySelector('[style*="opacity"]');
        if (placeholder) placeholder.remove();
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
      }

      updateMetrics(true);

      /* Button feedback */
      seedBtn.textContent = '⬡ LAUNCHING...';
      seedBtn.style.background = 'linear-gradient(135deg, rgba(255,153,51,0.45), rgba(153,0,0,0.45))';
      setTimeout(() => {
        seedBtn.textContent = '⬡ Compress Interstellar Seed';
        seedBtn.style.background = '';
      }, 800);
    });
  }
}

/* ── Live Metrics ── */
function updateMetrics(spikePower) {
  const fr = fluxRange / 100;
  const sp = seedPower / 100;
  const co = coherence / 100;
  const t  = performance.now() * 0.001;

  const powerBase = 120 + fr * 380 + sp * 220;
  const powerNoise = Math.sin(t * 1.7) * 12;
  const power = (powerBase + powerNoise + (spikePower ? sp * 150 : 0)).toFixed(1);

  const tempBase = 180000 + fr * 120000 + co * 80000;
  const temp = Math.round(tempBase + Math.sin(t * 2.3) * 5000);

  const decayBase = 0.035 - co * 0.022;
  const decay = (decayBase + Math.random() * 0.004).toFixed(4);

  const freqBase = 42 + fr * 180 + co * 95;
  const freq = (freqBase + Math.sin(t * 3.1) * 4).toFixed(2);

  const powerEl   = document.getElementById('metric-power');
  const tempEl    = document.getElementById('metric-temp');
  const decayEl   = document.getElementById('metric-decay');
  const freqEl    = document.getElementById('metric-freq');
  const barPower  = document.getElementById('bar-power');
  const barTemp   = document.getElementById('bar-temp');
  const barDecay  = document.getElementById('bar-decay');
  const barFreq   = document.getElementById('bar-freq');

  if (powerEl)  powerEl.textContent  = parseFloat(power) >= 1000 ? (parseFloat(power)/1000).toFixed(2) + 'k' : power;
  if (tempEl)   tempEl.textContent   = (temp/1000).toFixed(0) + 'k';
  if (decayEl)  decayEl.textContent  = decay;
  if (freqEl)   freqEl.textContent   = freq;

  if (barPower) barPower.style.width = Math.min(100, (parseFloat(power) / 900) * 100) + '%';
  if (barTemp)  barTemp.style.width  = Math.min(100, (temp / 400000) * 100) + '%';
  if (barDecay) barDecay.style.width = Math.min(100, (parseFloat(decay) / 0.04) * 100) + '%';
  if (barFreq)  barFreq.style.width  = Math.min(100, (parseFloat(freq) / 340) * 100) + '%';
}

/* ──────────────────────────────────────────────────────────
   SECTION 4: BOOT
────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();

  /* Defer Three.js until DOM is settled */
  requestAnimationFrame(() => {
    if (typeof THREE !== 'undefined') {
      initThreeJS();
    } else {
      /* Retry once if Three.js script not yet parsed */
      setTimeout(() => {
        if (typeof THREE !== 'undefined') initThreeJS();
        else console.warn('Project THUBAN: Three.js failed to load from CDN.');
      }, 500);
    }
  });

  /* Warm up metrics display immediately */
  setTimeout(() => {
    if (!fluxInitialized && document.getElementById('tab-flux').classList.contains('active')) {
      initFluxSimulator();
    }
  }, 300);
});
