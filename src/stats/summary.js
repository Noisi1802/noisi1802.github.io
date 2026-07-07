// Construit l'entrée d'historique (résumé + timeline) d'une séance jouée,
// au format JSON de PROJET.md §7, à partir des échantillons du recorder.
import { fmtPace } from '../ui/format.js';

export function buildSummary(session, samples, globalMs) {
  const duration_s = Math.round(globalMs / 1000);
  const distance_m = lastNonNull(samples, 'dist') ?? 0;

  const hrValues = pluck(samples, 'hr');
  const spmValues = pluck(samples, 'spm');
  const paceAvgSec = distance_m > 0 ? (duration_s / distance_m) * 500 : mean(pluck(samples, 'pace'));

  return {
    id: new Date().toISOString(),
    session_slug: session.slug,
    session_title: session.title,
    duration_s,
    distance_m: Math.round(distance_m),
    hr: {
      avg: hrValues.length ? Math.round(mean(hrValues)) : null,
      max: hrValues.length ? Math.max(...hrValues) : null,
    },
    pace_avg_500m: paceAvgSec ? fmtPace(paceAvgSec) : null,
    spm_avg: spmValues.length ? Math.round(mean(spmValues)) : null,
    sections: buildSections(session, samples),
    samples,
  };
}

function buildSections(session, samples) {
  const bySection = new Map();
  for (const s of samples) {
    if (!bySection.has(s.section)) bySection.set(s.section, []);
    bySection.get(s.section).push(s);
  }
  const out = [];
  let prevDist = 0;
  for (const [idx, arr] of [...bySection.entries()].sort((a, b) => a[0] - b[0])) {
    const name = session.sections[idx]?.name ?? `Section ${idx + 1}`;
    const lastDist = lastNonNull(arr, 'dist');
    const distance_m = lastDist != null ? Math.max(0, Math.round(lastDist - prevDist)) : 0;
    if (lastDist != null) prevDist = lastDist;
    out.push({ name, duration_s: arr.length, distance_m });
  }
  return out;
}

function pluck(arr, key) {
  return arr.map((x) => x[key]).filter((v) => v != null);
}
function lastNonNull(arr, key) {
  for (let i = arr.length - 1; i >= 0; i -= 1) if (arr[i][key] != null) return arr[i][key];
  return null;
}
function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
