// Export d'une séance jouée : .json (résumé complet) + .md (compte-rendu
// lisible) → Web Share API (je choisis Proton Drive dans le menu Android).
// Fallback hors mobile : téléchargement des deux fichiers.
import { fmtDuration, fmtDist } from '../ui/format.js';

export function buildJson(entry) {
  return JSON.stringify(entry, null, 2);
}

export function buildMarkdown(entry) {
  const date = new Date(entry.id).toLocaleString('fr-FR');
  const lines = [
    `# ${entry.session_title}`,
    `_${date}_`,
    '',
    `- **Durée** : ${fmtDuration(entry.duration_s)}`,
    `- **Distance** : ${fmtDist(entry.distance_m)}`,
    `- **Allure moy** : ${entry.pace_avg_500m ?? '—'} /500m`,
    `- **FC moy / max** : ${entry.hr.avg ?? '—'} / ${entry.hr.max ?? '—'} bpm`,
    `- **Cadence moy** : ${entry.spm_avg ?? '—'} spm`,
    '',
    '## Sections',
    '',
    '| Section | Durée | Distance |',
    '| --- | --- | --- |',
    ...entry.sections.map((s) => `| ${s.name} | ${fmtDuration(s.duration_s)} | ${fmtDist(s.distance_m)} |`),
    '',
  ];
  return lines.join('\n');
}

function baseName(entry) {
  return `ram-${entry.id.slice(0, 19).replace(/[:T]/g, '-')}`;
}

export async function shareSummary(entry) {
  const base = baseName(entry);
  const files = [
    new File([buildJson(entry)], `${base}.json`, { type: 'application/json' }),
    new File([buildMarkdown(entry)], `${base}.md`, { type: 'text/markdown' }),
  ];

  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: entry.session_title });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      // sinon on retombe sur le téléchargement
    }
  }
  for (const file of files) downloadFile(file);
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
