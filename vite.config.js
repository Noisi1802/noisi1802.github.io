import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// Réutilise le certificat auto-signé du spike (tools/.certs/) pour servir l'app
// en HTTPS sur le réseau local → indispensable pour tester le Web Bluetooth réel
// sur le téléphone. S'il est absent, on retombe en HTTP (démo only).
// Générer le cert au besoin : `node tools/serve-https.mjs` (une fois).
const key = resolve('tools/.certs/key.pem');
const cert = resolve('tools/.certs/cert.pem');
const https = existsSync(key) && existsSync(cert)
  ? { key: readFileSync(key), cert: readFileSync(cert) }
  : undefined;

// Version affichée dans l'app : version du package + hash court du commit
// (change à chaque déploiement → permet de voir si la PWA s'est mise à jour).
const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
let sha = 'dev';
try { sha = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* pas de git */ }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version} · ${sha}`),
  },
  server: { host: true, https },
  build: { target: 'es2022' },
});
