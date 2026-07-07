// Écran Détail : aperçu des sections + estimation, bouton Démarrer → Live.
import { getDefinition } from '../data/store.js';
import { fmtDuration, fmtDist, escapeHtml } from './format.js';
import { go } from './router.js';

export async function screenDetail({ slug }, outlet) {
  const s = await getDefinition(slug);
  if (!s) {
    outlet.innerHTML = '<main class="screen"><p class="empty">Séance introuvable.</p></main>';
    return;
  }

  const totalDur = s.sections.reduce((a, x) => a + (x.target.type === 'duration' ? x.target.value : 0), 0);
  const totalDist = s.sections.reduce((a, x) => a + (x.target.type === 'distance' ? x.target.value : 0), 0);

  outlet.innerHTML = `
    <header class="app-bar app-bar--detail">
      <button class="app-bar__back" data-back aria-label="Retour">‹</button>
      <h1 class="app-bar__title">${escapeHtml(s.title)}</h1>
    </header>
    <main class="screen">
      ${s.description ? `<p class="lead">${escapeHtml(s.description)}</p>` : ''}
      <div class="chips">
        ${totalDur ? `<span class="chip">≈ ${fmtDuration(totalDur)}</span>` : ''}
        ${totalDist ? `<span class="chip">${fmtDist(totalDist)}</span>` : ''}
        <span class="chip">mode ${escapeHtml(s.display)}</span>
        ${s.targetHrZone ? `<span class="chip">FC ${s.targetHrZone[0]}–${s.targetHrZone[1]}</span>` : ''}
      </div>
      <ol class="steps">${s.sections.map(stepHtml).join('')}</ol>
      <button class="btn btn--primary btn--block" data-start>Démarrer</button>
    </main>`;

  outlet.querySelector('[data-back]').addEventListener('click', () => go('/'));
  outlet.querySelector('[data-start]').addEventListener('click', () => go(`/live/${slug}`));
}

function stepHtml(x) {
  const target = x.target.type === 'duration' ? fmtDuration(x.target.value)
    : x.target.type === 'distance' ? fmtDist(x.target.value)
    : 'manuelle';
  const extra = [x.cadence && `cadence ${x.cadence}`, x.intensite].filter(Boolean).join(' · ');
  return `<li class="step">
    <div class="step__main">
      <span class="step__name">${escapeHtml(x.name)}</span>
      ${extra ? `<span class="step__extra">${escapeHtml(extra)}</span>` : ''}
      ${x.note ? `<span class="step__note">${escapeHtml(x.note)}</span>` : ''}
    </div>
    <span class="step__target">${escapeHtml(target)}</span>
  </li>`;
}
