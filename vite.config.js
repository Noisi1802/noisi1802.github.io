import { defineConfig } from 'vite';

// Racine = dossier projet. `host: true` expose le serveur de dev sur le réseau
// local (utile pour tester sur le téléphone). Build ciblée navigateurs récents.
export default defineConfig({
  server: { host: true },
  build: { target: 'es2022' },
});
