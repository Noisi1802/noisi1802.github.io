#!/usr/bin/env node
// Mini-serveur HTTPS statique pour le spike BLE (Lot 0).
// Web Bluetooth exige un contexte sécurisé : HTTPS obligatoire hors localhost.
// Sert le dossier tools/ sur 0.0.0.0:8443 avec un certificat auto-signé
// généré à la volée (openssl requis). Aucune dépendance npm.
//
//   node tools/serve-https.mjs
//
import { createServer } from "node:https";
import { readFile, stat, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { networkInterfaces } from "node:os";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const CERT_DIR = join(HERE, ".certs");
const KEY = join(CERT_DIR, "key.pem");
const CRT = join(CERT_DIR, "cert.pem");
const PORT = Number(process.env.PORT) || 8443;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const exists = (p) => access(p).then(() => true, () => false);

async function ensureCert() {
  if ((await exists(KEY)) && (await exists(CRT))) return;
  await mkdir(CERT_DIR, { recursive: true });
  console.log("→ Génération d'un certificat auto-signé (openssl)…");
  await execFileP("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", KEY, "-out", CRT, "-days", "365",
    "-subj", "/CN=ram-ble-spike",
    "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ]);
  console.log("  certificat créé dans tools/.certs/");
}

function lanIPs() {
  const out = [];
  for (const list of Object.values(networkInterfaces()))
    for (const ni of list || [])
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
  return out;
}

async function main() {
  try {
    await ensureCert();
  } catch (e) {
    console.error("✗ Impossible de générer le certificat. openssl est-il installé ?");
    console.error("  " + e.message);
    process.exit(1);
  }
  const [key, cert] = await Promise.all([readFile(KEY), readFile(CRT)]);

  const server = createServer({ key, cert }, async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "https://x").pathname);
      if (path === "/") path = "/ble-spike.html";
      // Empêche la remontée hors du dossier servi.
      const filePath = join(HERE, normalize(path).replace(/^(\.\.[/\\])+/, ""));
      if (!filePath.startsWith(HERE)) { res.writeHead(403).end("Forbidden"); return; }
      const s = await stat(filePath).catch(() => null);
      if (!s || !s.isFile()) { res.writeHead(404).end("Not found"); return; }
      const body = await readFile(filePath);
      res.writeHead(200, {
        "content-type": MIME[extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
      }).end(body);
    } catch (e) {
      res.writeHead(500).end("Server error: " + e.message);
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log("\nServeur HTTPS du spike BLE prêt :");
    console.log(`  • local    https://localhost:${PORT}/`);
    for (const ip of lanIPs()) console.log(`  • téléphone https://${ip}:${PORT}/`);
    console.log("\nSur le téléphone (même Wi-Fi) : ouvre l'URL, accepte l'avertissement");
    console.log("de certificat auto-signé (Paramètres avancés → Continuer). Ctrl+C pour arrêter.\n");
  });
}

main();
