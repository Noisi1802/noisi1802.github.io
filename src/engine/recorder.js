// Échantillonne la timeline à 1 Hz (métriques + section courante) pendant la
// séance. La timeline sert au graphe post-séance et aux stats (Lot 4).
// L'horodatage `t` suit le chrono ACTIF de l'engine (pauses exclues).
export function createRecorder(engine, bus) {
  const samples = [];
  let timer = null;

  function sample() {
    const snap = engine.snapshot();
    const m = bus.latest;
    samples.push({
      t: Math.round(snap.globalMs / 1000),
      section: snap.index,
      hr: m.hr,
      spm: m.spm,
      w: m.power,
      dist: m.dist,
      pace: m.pace,
    });
  }

  return {
    start() { samples.length = 0; timer = setInterval(sample, 1000); },
    pause() { clearInterval(timer); timer = null; },
    resume() { if (!timer) timer = setInterval(sample, 1000); },
    stop() { clearInterval(timer); timer = null; },
    get samples() { return samples; },
  };
}
