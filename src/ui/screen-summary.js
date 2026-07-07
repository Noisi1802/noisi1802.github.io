// Écran Résumé post-séance : totaux, FC moy/max, allure moy, mini-graphes
// (FC + allure), découpe par section, bouton Exporter (.md + .json → Proton).
import { getHistoryEntry } from '../data/store.js';
import { shareSummary } from '../data/export.js';
import { fmtDuration, fmtDist, escapeHtml } from './format.js';
import { go } from './router.js';

export async function screenSummary({ id }, outlet) {
  const entry = await getHistoryEntry(id);
  if (!entry) {
    outlet.innerHTML = '<main class="screen"><p class="empty">Séance introuvable.</p></main>';
    return;
  }
  const date = new Date(entry.id).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

  outlet.innerHTML = `
    <header class="app-bar app-bar--detail">
      <button class="app-bar__back" data-home aria-label="Accueil">‹</button>
      <h1 class="app-bar__title">${escapeHtml(entry.session_title)}</h1>
    </header>
    <main class="screen">
      <p class="lead">${escapeHtml(date)}</p>

      <section class="summary-grid">
        ${stat(fmtDuration(entry.duration_s), 'durée')}
        ${stat(fmtDist(entry.distance_m), 'distance')}
        ${stat(entry.pace_avg_500m ?? '—', 'allure /500m')}
        ${stat(entry.spm_avg ?? '—', 'cadence moy')}
        ${stat(entry.hr.avg ?? '—', 'fc moy')}
        ${stat(entry.hr.max ?? '—', 'fc max')}
      </section>

      ${sparkBlock('Fréquence cardiaque', entry.samples, 'hr', 'var(--c-err)')}
      ${sparkBlock('Allure /500m', entry.samples, 'pace', 'var(--c-accent-2)', true)}

      <div class="section-head"><h2 class="section-head__title">Sections</h2></div>
      <ul class="recap">
        ${entry.sections.map((s) => `<li class="recap__item">
          <span class="recap__name">${escapeHtml(s.name)}</span>
          <span class="recap__val">${fmtDuration(s.duration_s)} · ${fmtDist(s.distance_m)}</span>
        </li>`).join('')}
      </ul>

      <button class="btn btn--primary btn--block" data-export>Exporter (.md + .json)</button>
    </main>`;

  outlet.querySelector('[data-home]').addEventListener('click', () => go('/'));
  outlet.querySelector('[data-export]').addEventListener('click', () => shareSummary(entry));
}

function stat(value, key) {
  return `<div class="stats__item">
    <span class="stats__val">${escapeHtml(value)}</span>
    <span class="stats__key">${key}</span>
  </div>`;
}

function sparkBlock(title, samples, key, color, invert = false) {
  const path = sparkline(samples, key, invert);
  if (!path) return '';
  return `<div class="spark">
    <span class="spark__title">${title}</span>
    <svg class="spark__svg" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${path}" fill="none" stroke="${color}" stroke-width="1.2"
        vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  </div>`;
}

// Renvoie une suite de points "x,y" (viewBox 100×30) ou '' si pas de données.
function sparkline(samples, key, invert) {
  const pts = samples.map((s) => s[key]).filter((v) => v != null);
  if (pts.length < 2) return '';
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const n = pts.length;
  return pts.map((v, i) => {
    const x = (i / (n - 1)) * 100;
    let norm = (v - min) / span;        // 0 (min) → 1 (max)
    if (invert) norm = 1 - norm;        // allure : petit = mieux → en haut
    const y = 29 - norm * 28;           // marge 1px
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
