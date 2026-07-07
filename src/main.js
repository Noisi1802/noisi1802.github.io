import './styles/main.scss';
import { createRouter } from './ui/router.js';
import { screenHome } from './ui/screen-home.js';
import { screenDetail } from './ui/screen-detail.js';
import { screenLive } from './ui/screen-live.js';
import { screenSummary } from './ui/screen-summary.js';
import { getDefinitions, putDefinition } from './data/store.js';
import { parseSession, slugify } from './data/session-parser.js';

// Séances d'exemple livrées avec l'app : semées dans IndexedDB au 1er lancement
// (on ne réécrit pas si des définitions existent déjà → n'écrase pas les imports).
async function seedSessions() {
  if ((await getDefinitions()).length) return;
  const files = import.meta.glob('/sessions/*.md', { query: '?raw', import: 'default', eager: true });
  for (const [path, raw] of Object.entries(files)) {
    const slug = slugify(path.split('/').pop().replace(/\.md$/, ''));
    await putDefinition(parseSession(raw, slug));
  }
}

const outlet = document.getElementById('app');
const router = createRouter([
  ['/', screenHome],
  ['/session/:slug', screenDetail],
  ['/live/:slug', screenLive],
  ['/summary/:id', screenSummary],
], outlet);

seedSessions()
  .catch((e) => console.error('Seed séances échoué :', e))
  .finally(() => {
    if (!location.hash) location.hash = '/';
    router.start();
  });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
