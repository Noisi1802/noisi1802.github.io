// Écran Live : métrique « héro » + tuiles secondaires, chrono global + section,
// contrôles gros doigts, indicateur de zone FC. 4 modes (perf/cardio/complet/zen)
// changeables à la volée (cf. PROJET.md §6.1).
//
// Sources de données : capteurs BLE réels (rameur FTMS + FC Polar) branchés via
// des boutons « Connecter » explicites, OU le simulateur (mode démo, repli sans
// matériel). Toutes poussent dans le même bus normalisé.
import { getDefinition, putHistory } from '../data/store.js';
import { buildSummary } from '../stats/summary.js';
import { createMetricBus } from '../ble/normalizer.js';
import { createSimulator } from '../ble/simulator.js';
import { createRowerSource } from '../ble/rower.js';
import { createHeartSource } from '../ble/heart.js';
import { createSessionEngine } from '../engine/session-engine.js';
import { createRecorder } from '../engine/recorder.js';
import { fmtDuration, fmtPace, fmtDist, escapeHtml } from './format.js';
import { initAudio, cue } from './feedback.js';
import { go } from './router.js';

const BLE_OK = typeof navigator !== 'undefined' && !!navigator.bluetooth;

const MODES = ['perf', 'cardio', 'complet', 'zen'];

// Quelles métriques afficher par mode. `hero: null` → grille égale (mode complet).
const LAYOUT = {
  perf:    { hero: 'pace', tiles: ['spm', 'hr', 'sdist'] },
  cardio:  { hero: 'hr',   tiles: ['pace', 'spm', 'dist'] },
  complet: { hero: null,   tiles: ['pace', 'hr', 'spm', 'power', 'dist', 'stime'] },
  zen:     { hero: 'stime', tiles: ['pace'] },
};

// Descripteurs de métriques : (m = dernières métriques, s = snapshot engine).
const METRIC = {
  pace:  (m) => ({ k: '/500m', v: fmtPace(m.pace) }),
  hr:    (m) => ({ k: 'fc', v: m.hr ?? '—', u: 'bpm' }),
  spm:   (m) => ({ k: 'cadence', v: m.spm ?? '—', u: 'spm' }),
  power: (m) => ({ k: 'puissance', v: m.power ?? '—', u: 'W' }),
  dist:  (m) => ({ k: 'distance', v: m.dist != null ? fmtDist(m.dist) : '—' }),
  sdist: (m, s) => ({ k: 'dist. section', v: fmtDist(s.sectionDist || 0) }),
  stime: (m, s) => ({ k: 'chrono section', v: fmtDuration(s.sectionMs / 1000) }),
};

export async function screenLive({ slug }, outlet) {
  const session = await getDefinition(slug);
  if (!session) {
    outlet.innerHTML = '<main class="screen"><p class="empty">Séance introuvable.</p></main>';
    return {};
  }

  let mode = session.display;
  let demo = !BLE_OK; // sans Web Bluetooth (desktop) → démo par défaut
  const bus = createMetricBus();
  const engine = createSessionEngine(session);
  const sim = createSimulator(bus);
  const rower = createRowerSource(bus);
  const heart = createHeartSource(bus);
  const recorder = createRecorder(engine, bus);

  outlet.innerHTML = template(session);
  const els = {
    root: outlet.querySelector('.live'),
    global: outlet.querySelector('[data-global]'),
    counter: outlet.querySelector('[data-counter]'),
    sectionName: outlet.querySelector('[data-section-name]'),
    next: outlet.querySelector('[data-next]'),
    progress: outlet.querySelector('[data-progress]'),
    zone: outlet.querySelector('[data-zone]'),
    hero: outlet.querySelector('[data-hero]'),
    heroVal: outlet.querySelector('[data-hero-val]'),
    heroKey: outlet.querySelector('[data-hero-key]'),
    tiles: outlet.querySelector('[data-tiles]'),
    pause: outlet.querySelector('[data-pause]'),
    connectRower: outlet.querySelector('[data-connect-rower]'),
    connectHr: outlet.querySelector('[data-connect-hr]'),
    demo: outlet.querySelector('[data-demo]'),
    dotRower: outlet.querySelector('[data-dot-rower]'),
    dotHr: outlet.querySelector('[data-dot-hr]'),
  };

  function render() {
    const m = bus.latest;
    const s = engine.snapshot();

    els.global.textContent = fmtDuration(s.globalMs / 1000);
    els.counter.textContent = `${Math.min(s.index + 1, s.total)}/${s.total}`;
    els.sectionName.textContent = s.section ? s.section.name : '—';
    els.next.textContent = s.status === 'finished' ? 'terminé'
      : s.next ? `→ ${s.next.name}` : 'dernière section';
    els.progress.style.transform = `scaleX(${s.progress || 0})`;

    const cfg = LAYOUT[mode];
    if (cfg.hero === null) {
      els.hero.hidden = true;
    } else {
      els.hero.hidden = false;
      const d = METRIC[cfg.hero](m, s);
      els.heroVal.innerHTML = `${escapeHtml(d.v)}${d.u ? `<span class="hero__u"> ${d.u}</span>` : ''}`;
      els.heroKey.textContent = d.k;
    }

    els.tiles.className = `tiles tiles--${cfg.tiles.length}`;
    els.tiles.innerHTML = cfg.tiles.map((key) => tileHtml(METRIC[key](m, s))).join('');

    applyZone(m.hr);

    els.pause.textContent = s.status === 'idle' ? 'Démarrer'
      : s.status === 'running' ? 'Pause'
      : s.status === 'paused' ? 'Reprendre'
      : 'Terminé';
    els.pause.disabled = s.status === 'finished';
  }

  function applyZone(hr) {
    if (!session.targetHrZone || hr == null) { els.zone.hidden = true; return; }
    const [lo, hi] = session.targetHrZone;
    els.zone.hidden = false;
    const st = hr < lo ? 'low' : hr > hi ? 'high' : 'in';
    els.zone.dataset.state = st;
    els.zone.textContent = st === 'in' ? `zone ${lo}–${hi} ✓` : st === 'low' ? `sous ${lo}` : `au-dessus ${hi}`;
  }

  function setMode(next) {
    mode = next;
    els.root.dataset.mode = next;
    outlet.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === next));
    render();
  }

  async function onFinish() {
    sim.stop();
    recorder.stop();
    releaseWakeLock();
    if (!recorder.samples.length) { go(`/session/${slug}`); return; }
    const entry = buildSummary(session, recorder.samples, engine.snapshot().globalMs);
    try { await putHistory(entry); go(`/summary/${encodeURIComponent(entry.id)}`); }
    catch (e) { console.error('Sauvegarde historique échouée :', e); go(`/session/${slug}`); }
  }

  // --- Wake Lock (écran allumé pendant l'effort) -------------------------
  let wakeLock = null;
  async function acquireWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); }
    catch { wakeLock = null; }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  function onVisibility() {
    if (document.visibilityState === 'visible' && engine.status === 'running') acquireWakeLock();
  }
  document.addEventListener('visibilitychange', onVisibility);

  // --- Sources de données ------------------------------------------------
  function setDemo(on) {
    demo = on;
    els.demo.classList.toggle('is-active', on);
    if (on) sim.start(); else sim.stop();
  }

  function bindSource(source, btn, dot, label) {
    source.onStatus((state, detail) => {
      dot.dataset.state = state;
      btn.classList.toggle('is-active', state === 'connected');
      if (state === 'connected') { btn.textContent = detail || label; setDemo(false); }
      else if (state === 'reconnecting') btn.textContent = `repli… (${detail})`;
      else if (state === 'failed') btn.textContent = `${label} ✕`;
      btn.prepend(dot);
    });
    btn.addEventListener('click', async () => {
      if (source.connected) { source.disconnect(); btn.textContent = label; btn.prepend(dot); return; }
      try { await source.connect(); }
      catch (e) {
        if (e && e.name === 'NotFoundError') return; // sélection annulée
        console.error(`Connexion ${label} échouée :`, e);
        dot.dataset.state = 'failed';
      }
    });
  }

  if (BLE_OK) {
    bindSource(rower, els.connectRower, els.dotRower, 'Rameur');
    bindSource(heart, els.connectHr, els.dotHr, 'FC');
  } else {
    els.connectRower.disabled = true;
    els.connectHr.disabled = true;
  }
  els.demo.addEventListener('click', () => setDemo(!demo));
  if (demo) setDemo(true);

  // --- Moteur / boucle ---------------------------------------------------
  const unsubBus = bus.subscribe((m) => { engine.pushDistance(m.dist); render(); });
  const unsubEngine = engine.subscribe((type) => {
    if (type === 'section-auto' || type === 'section-change') cue();
    if (type === 'finished') { onFinish(); return; }
    render();
  });

  els.pause.addEventListener('click', () => {
    const st = engine.status;
    if (st === 'idle') { initAudio(); engine.start(); recorder.start(); acquireWakeLock(); if (demo) sim.start(); }
    else if (st === 'running') { engine.pause(); recorder.pause(); releaseWakeLock(); if (demo) sim.stop(); }
    else if (st === 'paused') { engine.resume(); recorder.resume(); acquireWakeLock(); if (demo) sim.start(); }
  });
  outlet.querySelector('[data-prev]').addEventListener('click', () => engine.prev());
  outlet.querySelector('[data-next]').addEventListener('click', () => engine.next());
  outlet.querySelector('[data-quit]').addEventListener('click', () => go(`/session/${slug}`));
  outlet.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  setMode(mode);

  return {
    cleanup() {
      unsubBus();
      unsubEngine();
      document.removeEventListener('visibilitychange', onVisibility);
      releaseWakeLock();
      sim.stop();
      recorder.stop();
      rower.disconnect();
      heart.disconnect();
      if (engine.status !== 'finished') engine.finish();
    },
  };
}

function tileHtml(d) {
  return `<div class="tile">
    <span class="tile__key">${d.k}</span>
    <span class="tile__val">${escapeHtml(d.v)}${d.u ? `<span class="tile__u"> ${d.u}</span>` : ''}</span>
  </div>`;
}

function template() {
  return `
  <div class="live" data-mode="perf">
    <div class="live__bar">
      <button class="live__quit" data-quit aria-label="Quitter">‹</button>
      <span class="live__global" data-global>0:00</span>
      <span class="live__counter" data-counter></span>
    </div>

    <div class="live__section">
      <span class="live__section-name" data-section-name>—</span>
      <span class="live__next" data-next></span>
    </div>
    <div class="live__progress"><span class="live__progress-fill" data-progress></span></div>
    <div class="live__zone" data-zone hidden></div>

    <div class="sources">
      <button class="sources__btn" data-connect-rower><span class="sources__dot" data-dot-rower></span>Rameur</button>
      <button class="sources__btn" data-connect-hr><span class="sources__dot" data-dot-hr></span>FC</button>
      <button class="sources__btn" data-demo>Démo</button>
    </div>

    <div class="hero" data-hero>
      <span class="hero__val" data-hero-val>—</span>
      <span class="hero__key" data-hero-key></span>
    </div>
    <div class="tiles" data-tiles></div>

    <div class="controls">
      <button class="controls__btn" data-prev aria-label="Section précédente">◀</button>
      <button class="controls__btn controls__btn--main" data-pause>Démarrer</button>
      <button class="controls__btn" data-next aria-label="Section suivante">▶</button>
    </div>

    <div class="modes">
      ${MODES.map((m) => `<button class="modes__btn" data-mode="${m}">${m}</button>`).join('')}
    </div>
  </div>`;
}
