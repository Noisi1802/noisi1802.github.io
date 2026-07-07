// Machine à états d'une séance : idle → running ⇄ paused → finished.
// Le cerveau : il ne sait ni d'où viennent les données ni comment elles
// s'affichent → testable avec des données simulées (cf. PROJET.md §3, §5).
//
// Événements émis à l'abonné : 'start' | 'tick' | 'pause' | 'resume'
//   | 'section-change' (manuel) | 'section-auto' (cible atteinte) | 'finished'.

const UI_EMIT_MS = 100; // fréquence max de rafraîchissement UI pendant le run

export function createSessionEngine(session) {
  const sections = session.sections;
  const listeners = new Set();
  const state = {
    status: 'idle',
    index: 0,
    globalMs: 0,
    sectionMs: 0,
    sectionDist: 0,
    distAtSectionStart: null,
    lastDist: null,
  };
  let ticker = null;
  let lastTs = 0;
  let lastEmit = 0;

  const section = () => sections[state.index] || null;

  function snapshot() {
    const s = section();
    return {
      status: state.status,
      index: state.index,
      total: sections.length,
      section: s,
      next: sections[state.index + 1] || null,
      globalMs: state.globalMs,
      sectionMs: state.sectionMs,
      sectionDist: state.sectionDist,
      progress: sectionProgress(s),
    };
  }

  function sectionProgress(s) {
    if (!s) return 0;
    if (s.target.type === 'duration') return clamp01(state.sectionMs / (s.target.value * 1000));
    if (s.target.type === 'distance') return clamp01(state.sectionDist / s.target.value);
    return 0; // manuelle : pas de progression automatique
  }

  function emit(type) {
    const snap = snapshot();
    for (const fn of listeners) fn(type, snap);
  }

  // Boucle unique : `tick` est le seul à ré-armer le requestAnimationFrame.
  function tick(ts) {
    if (state.status !== 'running') return;
    const dt = lastTs ? ts - lastTs : 0;
    lastTs = ts;
    state.globalMs += dt;
    state.sectionMs += dt;
    checkSectionEnd();                       // peut faire avancer / terminer
    if (state.status !== 'running') return;  // terminé pendant l'avance → stop
    if (ts - lastEmit >= UI_EMIT_MS) { lastEmit = ts; emit('tick'); }
    ticker = requestAnimationFrame(tick);
  }

  function checkSectionEnd() {
    const s = section();
    if (!s) return;
    const reached =
      (s.target.type === 'duration' && state.sectionMs >= s.target.value * 1000) ||
      (s.target.type === 'distance' && state.sectionDist >= s.target.value);
    if (reached) advance(1, true);
  }

  function enterSection(i) {
    state.index = i;
    state.sectionMs = 0;
    state.distAtSectionStart = state.lastDist;
    state.sectionDist = 0;
  }

  function advance(dir, auto = false) {
    const target = state.index + dir;
    if (target >= sections.length) { finish(); return; }
    if (target < 0) return;
    enterSection(target);
    emit(auto ? 'section-auto' : 'section-change');
    // Pas de re-scheduling ici : si on tourne, la boucle `tick` est déjà vivante
    // (avance manuelle) ou reprend juste après (avance auto, depuis `tick`).
  }

  function start() {
    if (state.status !== 'idle') return;
    state.status = 'running';
    enterSection(0);
    lastTs = 0;
    lastEmit = 0;
    emit('start');
    ticker = requestAnimationFrame(tick);
  }

  function pause() {
    if (state.status !== 'running') return;
    state.status = 'paused';
    cancelAnimationFrame(ticker);
    emit('pause');
  }

  function resume() {
    if (state.status !== 'paused') return;
    state.status = 'running';
    lastTs = 0;
    lastEmit = 0;
    emit('resume');
    ticker = requestAnimationFrame(tick);
  }

  function finish() {
    if (state.status === 'finished') return;
    state.status = 'finished';
    cancelAnimationFrame(ticker);
    emit('finished');
  }

  // Alimenté par le bus de métriques : distance cumulée de l'appareil.
  function pushDistance(distCumul) {
    if (distCumul == null) return;
    if (state.distAtSectionStart == null) state.distAtSectionStart = distCumul;
    state.lastDist = distCumul;
    state.sectionDist = Math.max(0, distCumul - state.distAtSectionStart);
    if (state.status === 'running') checkSectionEnd();
  }

  return {
    start,
    pause,
    resume,
    finish,
    next: () => advance(1, false),
    prev: () => advance(-1, false),
    pushDistance,
    snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get status() { return state.status; },
  };
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
