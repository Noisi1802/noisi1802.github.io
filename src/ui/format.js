// Helpers d'affichage partagés.

// Secondes → "h:mm:ss" ou "m:ss".
export function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Allure (secondes / 500 m) → "m:ss".
export function fmtPace(paceSeconds) {
  if (paceSeconds == null || paceSeconds <= 0 || paceSeconds >= 3600) return '—:—';
  const s = Math.round(paceSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Mètres → "1.23 km" ou "456 m".
export function fmtDist(meters) {
  if (meters == null) return '—';
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
