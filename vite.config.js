import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
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

export default defineConfig({
  server: { host: true, https },
  build: { target: 'es2022' },
});
