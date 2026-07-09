// Repères sensoriels au changement de section : vibration + court bip.
// L'AudioContext doit être créé/réveillé depuis un geste utilisateur
// (appel à initAudio() au clic « Démarrer »).
let ctx = null;

export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx && AC) ctx = new AC();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function cue() {
  if (navigator.vibrate) navigator.vibrate(120);
  beep();
}

function beep() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  osc.start(t);
  osc.stop(t + 0.26);
}
