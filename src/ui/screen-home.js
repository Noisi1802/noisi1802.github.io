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

  outlet.innerHTML = `
    <header class="app-bar">
      <h1 class="app-bar__title">RAM</h1>
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
        <label class="btn btn--ghost">
          Importer<input id="import" type="file" accept=".md,text/markdown" hidden>
        </label>
      </div>

      <ul class="card-list">
        ${defs.length
          ? defs.map(cardHtml).join('')
          : '<li class="empty">Aucune séance. Importe un <code>.md</code> ou dépose un fichier dans <code>sessions/</code>.</li>'}
      </ul>
    </main>`;

  outlet.querySelectorAll('[data-slug]').forEach((el) => {
    el.addEventListener('click', () => go(`/session/${el.dataset.slug}`));
  });

  const input = outlet.querySelector('#import');
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const session = parseSession(await file.text());
    await putDefinition(session);
    go(`/session/${session.slug}`);
  });
}

function statItem(value, key) {
  return `<div class="stats__item">
    <span class="stats__val">${escapeHtml(value)}</span>
    <span class="stats__key">${key}</span>
  </div>`;
}

function cardHtml(s) {
  const meta = [s.type, `${s.sections.length} sections`].filter(Boolean).join(' · ');
  return `<li class="card" data-slug="${escapeHtml(s.slug)}" role="button" tabindex="0">
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(s.title)}</h3>
      <p class="card__meta">${escapeHtml(meta)}</p>
      ${s.description ? `<p class="card__desc">${escapeHtml(s.description)}</p>` : ''}
    </div>
    <span class="card__go" aria-hidden="true">▶</span>
  </li>`;
}
