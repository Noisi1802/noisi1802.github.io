// Stats globales à partir de l'historique JSON (cf. PROJET.md §7).
export function aggregate(history) {
  const base = { count: 0, distance: 0, duration: 0, hrAvg: null };
  if (!history || !history.length) return base;

  let distance = 0;
  let duration = 0;
  let hrSum = 0;
  let hrCount = 0;
  for (const h of history) {
    distance += h.distance_m || 0;
    duration += h.duration_s || 0;
    if (h.hr && h.hr.avg) { hrSum += h.hr.avg; hrCount += 1; }
  }
  return {
    count: history.length,
    distance,
    duration,
    hrAvg: hrCount ? Math.round(hrSum / hrCount) : null,
  };
}
