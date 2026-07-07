// Routeur minimal basé sur le hash (#/...). Chaque route est un couple
// [pattern, handler]. Le handler peut renvoyer { cleanup } appelé au départ
// de la vue (indispensable pour l'écran Live : arrêt moteur/simulateur).

export function createRouter(routes, outlet) {
  let current = null;

  async function resolve() {
    if (current && typeof current.cleanup === 'function') current.cleanup();
    current = null;
    const path = location.hash.slice(1) || '/';
    for (const [pattern, handler] of routes) {
      const params = match(pattern, path);
      if (params) { current = (await handler(params, outlet)) || {}; return; }
    }
    outlet.innerHTML = '<main class="screen"><p class="empty">Page introuvable.</p></main>';
  }

  function match(pattern, path) {
    const pp = pattern.split('/');
    const ap = path.split('/');
    if (pp.length !== ap.length) return null;
    const params = {};
    for (let i = 0; i < pp.length; i += 1) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
      else if (pp[i] !== ap[i]) return null;
    }
    return params;
  }

  window.addEventListener('hashchange', resolve);
  return { start: resolve, refresh: resolve };
}

export function go(path) {
  if (location.hash.slice(1) === path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}
