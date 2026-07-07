// Contrat d'échantillon normalisé émis par TOUTE source de données
// (simulateur en Lot 2, capteurs BLE réels en Lot 3). L'engine et l'UI ne
// consomment que ce format : ils ignorent d'où viennent les données.
//
//   hr      : fréquence cardiaque (bpm)        — source Polar
//   spm     : cadence (coups / min)            — source rameur
//   power   : puissance (W)                    — source rameur
//   dist    : distance cumulée (m)             — source rameur
//   pace    : allure (secondes / 500 m)        — source rameur
//   strokes : nombre de coups cumulé           — source rameur
export const METRIC_KEYS = ['hr', 'spm', 'power', 'dist', 'pace', 'strokes'];

// Petit bus : chaque source pousse des mises à jour partielles ; les
// abonnés reçoivent l'état fusionné le plus récent.
export function createMetricBus() {
  const latest = Object.fromEntries(METRIC_KEYS.map((k) => [k, null]));
  latest.t = 0;
  const listeners = new Set();

  return {
    latest,
    update(partial) {
      Object.assign(latest, partial);
      latest.t = performance.now();
      for (const fn of listeners) fn(latest);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reset() {
      for (const k of METRIC_KEYS) latest[k] = null;
    },
  };
}
