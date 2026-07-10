// Écran Accueil : stats globales + listing des séances. Bouton Importer (.md).
import { getDefinitions, getHistory, putDefinition } from '../data/store.js';
import { aggregate } from '../stats/aggregate.js';
import { parseSession } from '../data/session-parser.js';
import { fmtDuration, fmtDist, escapeHtml } from './format.js';
import { go } from './router.js';

export async function screenHome(_params, outlet) {
  const [defs, history] = await Promise.all([getDefinitions(), getHistory()]);
  const stats = aggregate(history);
  defs.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  const recent = [...history].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

  outlet.innerHTML = `
    <header class="app-bar">
      <h1 class="app-bar__title">rame rame</h1>
      <span class="app-bar__sub">Rowing Assistant</span>
    </header>
    <main class="screen">
      <section class="stats" aria-label="Statistiques globales">
        ${statItem(stats.count, 'séances')}
        ${statItem(fmtDist(stats.distance), 'distance')}
        ${statItem(fmtDuration(stats.duration), 'temps')}
        ${statItem(stats.hrAvg ?? '—', 'fc moy')}
      </section>

      <div class="section-head">
        <h2 class="section-head__title">Séances</h2>
        <button class="btn btn--ghost" id="import-btn">Importer</button>
        <input id="import" class="sr-only" type="file" accept=".md,.txt,.markdown,text/markdown,text/plain,*/*">
      </div>

      <ul class="card-list">
        ${defs.length
          ? defs.map(cardHtml).join('')
          : '<li class="empty">Aucune séance. Importe un <code>.md</code> ou dépose un fichier dans <code>sessions/</code>.</li>'}
      </ul>

      ${recent.length ? `
        <div class="section-head"><h2 class="section-head__title">Dernières séances</h2></div>
        <ul class="history">
          ${recent.map(historyHtml).join('')}
        </ul>` : ''}

      <footer class="app-version">${__APP_VERSION__}</footer>
    </main>`;

  outlet.querySelectorAll('[data-slug]').forEach((el) => {
    el.addEventListener('click', () => go(`/session/${el.dataset.slug}`));
  });
  outlet.querySelectorAll('[data-history]').forEach((el) => {
    el.addEventListener('click', () => go(`/summary/${encodeURIComponent(el.dataset.history)}`));
  });

  const input = outlet.querySelector('#import');
  const btn = outlet.querySelector('#import-btn');
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const session = parseSession(text);
      await putDefinition(session);
      go(`/session/${session.slug}`);
    } catch (e) {
      console.error('Import échoué :', e);
    }
  });
}

function statItem(value, key) {
  return `<div class="stats__item">
    <span class="stats__val">${escapeHtml(value)}</span>
    <span class="stats__key">${key}</span>
  </div>`;
}

function historyHtml(h) {
  const date = new Date(h.id).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const meta = [fmtDist(h.distance_m), fmtDuration(h.duration_s), h.hr.avg ? `${h.hr.avg} bpm` : null]
    .filter(Boolean).join(' · ');
  return `<li class="history__item" data-history="${escapeHtml(h.id)}" role="button" tabindex="0">
    <span class="history__title">${escapeHtml(h.session_title)}</span>
    <span class="history__meta">${escapeHtml(date)} — ${escapeHtml(meta)}</span>
  </li>`;
}

function cardHtml(s) {
  const meta = [s.type, `${s.sections.length} sections`].filter(Boolean).join(' · ');
  return `<li class="card" data-slug="${escapeHtml(s.slug)}" role="button" tabindex="0">
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(s.title)}</h3>
      <p class="card__meta">${escapeHtml(meta)}</p>
      ${s.description ? `<p class="card__desc">${escapeHtml(s.description)}</p>` : ''}`
    + `</div>
    <span class="card__go" aria-hidden="true">▶</span>
  </li>`;
}
