# Lot 0 — Spike Bluetooth (dé-risquage)

Outil de diagnostic pour découvrir le protocole BLE du **Merach R50** et valider la
lecture FC du **Polar Verity Sense**. Objectif : décider si `rower.js` s'appuie sur
**FTMS** (`0x1826` / Rower Data `0x2AD1`) ou sur un protocole **propriétaire**.

- `ble-spike.html` — page autonome (zéro build) : scan, énumération des services/
  caractéristiques, abonnement aux notifications, décodage FTMS Rower Data + FC.
- `serve-https.mjs` — mini-serveur HTTPS (Node natif + openssl, aucune dépendance npm).

> Web Bluetooth n'existe **que sur Chrome Android** (pas Firefox, pas iOS) et exige un
> **contexte sécurisé** : HTTPS, ou `localhost`.

---

## Test demain — méthode A : HTTPS sur le Wi-Fi (sans câble)

Sur le PC :

```bash
node tools/serve-https.mjs
```

Le script génère un certificat auto-signé et affiche les URL, dont une du type
`https://192.168.1.87:8443/`.

Sur le **téléphone Android** (même Wi-Fi) :

1. Ouvre cette URL dans **Chrome**.
2. Avertissement de certificat → **Paramètres avancés → Continuer vers le site**.
3. **Allume le Merach R50**, appuie sur **« Scanner Merach R50 »**, choisis-le.
4. Regarde le journal se remplir, puis **lance une séance sur le rameur** (rame
   quelques coups) pour voir défiler les trames.
5. Appuie sur **« Connecter Polar FC »**, choisis le Polar, vérifie que la FC monte.
6. **« Exporter »** → partage le `.txt` vers Proton Drive (ou moi) : c'est ce log
   qui sert à écrire `rower.js`.

## Test demain — méthode B : port-forward USB (sans certificat)

Aucun avertissement de sécurité, `localhost` est déjà un contexte sûr.

1. Téléphone en **débogage USB** branché au PC.
2. PC : `node tools/serve-https.mjs` (ou n'importe quel serveur statique sur `tools/`).
3. Chrome desktop → `chrome://inspect/#devices` → **Port forwarding** →
   `8443` → `localhost:8443`.
4. Sur le téléphone, ouvre `https://localhost:8443/` → même procédure qu'au-dessus.

---

## Ce qu'on cherche à confirmer (cf. PROJET.md §2 R1 et §6.1)

- [ ] Le Merach expose-t-il le service **FTMS `0x1826`** ?
- [ ] Si oui, reçoit-on des trames **Rower Data `0x2AD1`** en ramant ?
- [ ] **Allure /500m, cadence (spm), distance** sont-elles cohérentes ?
- [ ] **Puissance (W)** est-elle présente et crédible (ou à reléguer) ?
- [ ] Sinon : quels **UUID propriétaires** (`0xFFxx`, Nordic UART…) et quel motif de trame ?
- [ ] **Polar** : FC lue proprement sur `0x2A37` ?

## Notes

- `tools/.certs/` (certificat auto-signé) est ignoré par git — régénéré au besoin.
- Le spike est volontairement hors de `src/` : c'est un jetable de dé-risquage, pas du
  code applicatif (donc CSS inline, pas de SCSS/SDC).
