# RAM — Rowing Assistant (PWA perso)

> PWA hors-ligne pour accompagner mes séances de rameur (Merach R50) avec suivi
> cardio (Polar Verity Sense). 100 % local, aucune donnée envoyée sur un serveur.

---

## 1. Objectifs & principes

- **Simple** : pas de backend, pas de compte, pas d'analytics. Tout tourne dans le navigateur du téléphone.
- **Privacy-first** : données stockées en local (IndexedDB). Sauvegarde/synchro = fichiers exportés vers **Proton Drive** via le partage Android.
- **Offline-first** : PWA installable, utilisable sans réseau (service worker).
- **Séances éditables à la main** : les plans de séance sont des fichiers **Markdown** que je peux écrire/modifier au clavier.
- **Historique exploitable** : chaque séance jouée produit un résumé **JSON** + des stats globales.

### Décisions actées
| Sujet | Choix |
|---|---|
| Appareil pendant la séance | Smartphone **Android** (PWA installée) |
| Lecture capteurs | **Web Bluetooth** (Chrome Android) |
| Stack | **Vite + Vanilla JS + SCSS** (BEM, nesting max 3) |
| Stockage runtime | **IndexedDB** |
| Synchro | Export fichiers → app **Proton Drive** (Web Share API) ; import via sélecteur de fichier |

---

## 2. Risques techniques (à traiter en priorité)

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| **R1** | **Merach R50** : protocole BLE inconnu (FTMS standard `0x1826` **ou** propriétaire). | 🔴 Bloquant : sans lecture, pas de métriques rameur. | **Lot 0** : spike de découverte des services BLE avant tout dev. |
| R2 | Web Bluetooth exige HTTPS + un geste utilisateur pour appairer. | 🟠 | Bouton « Connecter » explicite ; app servie en HTTPS (même en local). |
| R3 | Reconnexion BLE après perte de signal / écran verrouillé. | 🟠 | **Wake Lock API** (écran allumé) + logique de reconnexion auto. |
| R4 | Pas d'accès fichier direct sur Chrome Android (pas de File System Access API). | 🟡 | Export via **Web Share API** ; import via `<input type="file">`. |
| R5 | Polar Verity Sense — capteur standard HR. | 🟢 Faible | Service `0x180D` / caractéristique `0x2A37`, bien documenté. |

---

## 3. Architecture (modules)

```
ram/
├─ index.html
├─ manifest.webmanifest
├─ sw.js                     # service worker (offline)
├─ src/
│  ├─ main.js                # bootstrap + routeur simple
│  ├─ data/
│  │  ├─ session-parser.js   # Markdown → objet Session
│  │  ├─ store.js            # IndexedDB (définitions + historique)
│  │  └─ export.js           # export .md/.json via Web Share API, import fichier
│  ├─ ble/
│  │  ├─ heart.js            # Polar — BLE Heart Rate standard (0x180D)
│  │  ├─ rower.js            # Merach R50 — FTMS (0x1826) ou driver dédié
│  │  └─ normalizer.js       # événements normalisés (hr, spm, power, dist, pace…)
│  ├─ engine/
│  │  ├─ session-engine.js   # machine à états (idle/running/paused) + chrono
│  │  └─ recorder.js         # échantillonnage timeline (métriques + FC)
│  ├─ stats/
│  │  └─ aggregate.js        # stats globales à partir de l'historique JSON
│  ├─ ui/
│  │  ├─ screen-home.js      # listing séances + stats globales
│  │  ├─ screen-detail.js    # aperçu d'une séance avant lancement
│  │  ├─ screen-live.js      # écran séance en cours
│  │  └─ screen-summary.js   # résumé post-séance
│  └─ styles/
│     ├─ main.scss
│     └─ _*.scss             # BEM, kebab-case
└─ sessions/                 # plans de séance en Markdown (édités à la main)
   └─ 2026-07-06-pyramide.md
```

### Séparation des responsabilités
- **`ble/`** ne connaît rien de l'UI : il émet des événements normalisés.
- **`engine/`** est le cerveau : il ne sait pas d'où viennent les données ni comment elles s'affichent → **testable avec des données simulées** (indispensable pour bosser sans être sur le rameur).
- **`ui/`** consomme l'engine et le store, ne fait aucun calcul métier.

---

## 4. Format d'une séance (Markdown)

Séance = frontmatter (métadonnées) + une liste de **sections** (échauffement, intervalles, récup…).
Chaque section a une **cible de fin** : durée, distance, ou manuelle.

```markdown
---
title: Pyramide 500m
type: intervalles
description: Échauffement + pyramide + retour au calme
target_hr_zone: [130, 160]   # optionnel, zone FC cible affichée (mode cardio)
display: perf                 # perf | cardio | complet | zen — défaut: perf
---

## Échauffement            <!-- section -->
- duree: 5:00
- intensite: facile
- note: cadence libre, monter progressivement

## Intervalle 1
- distance: 500m
- cadence: 24-26 spm
- note: allure tenue

## Récup 1
- duree: 2:00
- intensite: facile

## Intervalle 2
- distance: 750m
- cadence: 24-26 spm

## Retour au calme
- duree: 5:00
- intensite: très facile
```

**Règles de parsing (simples et tolérantes) :**
- Chaque `##` = une nouvelle section (le titre = nom affiché).
- Clés reconnues : `duree` (`m:ss`), `distance` (`Nm`/`Nkm`), `cadence`, `intensite`, `note`.
- `duree` **ou** `distance` définit la condition de fin ; sans les deux → section **manuelle** (je passe à la suivante avec le bouton « suivant »).

---

## 5. Moteur de séance (machine à états)

États : `idle → running ⇄ paused → finished`

Contrôles demandés :
- **Pause / Reprise** : gèle le chrono global + chrono de section.
- **Revenir en arrière** : `section précédente` (rejouer une section) et `section suivante`.
- **Fin auto de section** : quand la cible (durée/distance) est atteinte → passage auto (avec petit signal sonore/vibration).

Le **recorder** échantillonne (ex. 1 Hz) : timestamp, section, FC, cadence (spm), puissance (W), distance, allure (/500m). Cette timeline est stockée avec le résumé de séance → permet un graphe post-séance et les stats.

---

## 6. Écrans (UI)

1. **Accueil** — liste des séances dispo (depuis `sessions/`) + **stats globales** (nb séances, distance totale, temps total, FC moy…). Bouton « Importer une séance ».
2. **Détail séance** — aperçu des sections, durée/distance estimée, bouton **« Démarrer »** (déclenche l'appairage BLE).
3. **Live** — le cœur de l'app (voir §6.1 pour les modes d'affichage) :
   - **1 métrique “héro”** en géant + **3-4 tuiles secondaires**.
   - **Chrono** global + chrono/progression de la **section en cours**.
   - Nom de la section + **la suivante**.
   - Contrôles gros doigts : **Pause**, **◀ Précédent**, **Suivant ▶**.
   - Indicateur de **zone FC** (couleur) si `target_hr_zone` défini.
4. **Résumé post-séance** — totaux, FC moy/max, allure moy, mini-graphe, boutons **« Exporter (.md + .json) »** → partage Proton.

**Contraintes UX rameur** (mains moites, effort, écran de loin) : grandes zones tactiles, gros chiffres, fort contraste, thème sombre par défaut, **Wake Lock** (écran ne s'éteint pas).

### 6.1 Modes d'affichage de l'écran Live

Principe : **1 métrique “héro” en géant + 3-4 tuiles secondaires**. Le mode est choisi
par séance via le champ `display` du frontmatter (défaut : `perf`), changeable à la volée
pendant la séance.

| Mode | Héro (géant) | Tuiles secondaires | Usage |
|---|---|---|---|
| **`perf`** *(défaut)* | **Allure /500m** | Cadence (spm) · FC · Distance section | Intervalles, pyramides — l'allure est la référence rameur |
| **`cardio`** | **FC** (+ zone couleur) | Allure · Cadence · Distance | Endurance, travail en zones FC |
| **`complet`** | grille 6 tuiles égales | Allure · FC · Cadence · Puissance · Distance · Chrono section | Tout voir d'un coup |
| **`zen`** | **Chrono section** | 1 seule tuile (allure) | Séance libre, focus ressenti |

**Fiabilité des métriques (priorité de confiance) :**
1. **FC** — Polar Verity Sense dédié, standard BLE → toujours fiable.
2. **Allure /500m · Cadence · Distance · Chrono** — dépendent du Merach (FTMS) → à valider Lot 0, mais standard.
3. **Puissance (W)** — dépend de la courbe de résistance du Merach → potentiellement peu fiable, à confirmer Lot 0. Reléguée en secondaire.

**Chrono toujours visible** quel que soit le mode (bandeau permanent : global + section).

---

## 7. Stockage & synchro

- **Runtime** : IndexedDB
  - `definitions` : séances importées (parsées depuis le .md).
  - `history` : une entrée JSON par séance jouée (résumé + timeline).
- **Export** (bouton) : génère `.json` (résumé complet) + `.md` lisible (compte-rendu) → **Web Share API** → je choisis **Proton Drive** dans le menu Android.
- **Import** : `<input type="file">` pour charger un `.md` de séance édité à la main (depuis Proton).
- **Format historique JSON** (par séance) :

```json
{
  "id": "2026-07-06T18:30:00",
  "session_title": "Pyramide 500m",
  "duration_s": 1980,
  "distance_m": 4200,
  "hr": { "avg": 142, "max": 168 },
  "pace_avg_500m": "2:21",
  "spm_avg": 25,
  "sections": [ { "name": "Échauffement", "duration_s": 300, "distance_m": 780 } ],
  "samples": [ { "t": 1, "hr": 110, "spm": 22, "w": 90, "dist": 4, "pace": 145 } ]
}
```

---

## 8. Roadmap (lots)

- **Lot 0 — Spike Bluetooth (dé-risquage)** 🔴 *à faire en premier*
  - Petite page qui liste les services/caractéristiques BLE du Merach R50.
  - Confirmer : FTMS (`0x1826` / Rower Data `0x2AD1`) ou propriétaire → décide de `rower.js`.
  - Valider en parallèle la lecture FC du Polar.
- **Lot 1 — Squelette** : projet Vite, PWA (manifest + SW), store IndexedDB, parser Markdown, écran Accueil + listing.
- **Lot 2 — Moteur + Live (données simulées)** : machine à états, chrono, pause, précédent/suivant, écran Live branché sur un **générateur de données factices**.
- **Lot 3 — Bluetooth réel** : `heart.js` + `rower.js` + `normalizer.js`, branchés sur l'écran Live.
- **Lot 4 — Historique & stats** : recorder, résumé post-séance, agrégations, export/import Proton.
- **Lot 5 — Finitions** : Wake Lock, offline complet, install PWA, signaux sonores/vibration, thème sombre.

---

## 9. Suggestions d'amélioration (optionnel, à trancher plus tard)

- **Wake Lock API** : garder l'écran allumé pendant la séance (quasi indispensable). ✅ retenu Lot 5.
- **Repères audio/vibration** au changement de section (utile quand on ne regarde pas l'écran).
- **Annonces vocales** (Web Speech / TTS) : « 250 m restants », « section suivante ».
- **Zones FC colorées** en temps réel (vert/orange/rouge) selon `target_hr_zone`.
- **Auto-lap** par section : stats détaillées par intervalle.
- **Export .FIT ou .TCX** plus tard, pour pousser vers Strava/Garmin si envie (sans compromettre la privacy : export manuel).
- **Comparaison** d'une même séance dans le temps (progression allure/FC).
- **Mode démo** (générateur de données) livré avec l'app → dev et test sans rameur.

---

## 10. État des décisions
- ✅ Format Markdown de séance : validé (ajustable au fil de l'eau).
- ✅ Fin de section par **temps ou distance** : validé (lisible nativement en FTMS).
- ✅ Écran Live : **métrique héro + secondaires**, 4 modes (`perf`/`cardio`/`complet`/`zen`), champ `display` par séance. Défaut `perf` (allure /500m en héro).
- ⏳ **Lot 0** (protocole Merach R50) : à lancer dès réception du rameur (demain). Détermine `rower.js` et la fiabilité réelle allure/puissance.
- ⏳ Rameur reçu demain → objectif : tout formalisé avant, spike prêt à lancer.

---

## 11. Fonctionnalité « Retour au calme » (cohérence cardiaque) — EN COURS

> Nouvelle section de fin de séance : le rameur s'arrête, l'écran passe en mode
> récup et guide un exercice de respiration pour **faire redescendre la FC sous un
> seuil cible**. Objectif physio : expiration plus longue que l'inspiration →
> active le parasympathique → chute rapide du rythme cardiaque.

### Décisions actées (2026-07-10)
- ✅ **Nouveau type de cible de section : `hr`** (finit quand FC < seuil). S'ajoute
  à `duration` / `distance` / `manual` dans `session-engine.js` (`checkSectionEnd`).
- ✅ **Seuil = dynamique `max-40`** : FC max atteinte dans la séance − 40 bpm.
  Aucun profil utilisateur requis, s'adapte à l'intensité réelle.
  (Le parser gère aussi `cible_fc: 100` fixe — gratuit, non prioritaire.)
- ✅ **Définie dans le Markdown** : une section `##` avec `cible_fc:`, cohérent
  avec le modèle « séance = suite de sections ». Ajoutable à n'importe quelle séance.
- ✅ **`duree` sur une section `hr` = plafond de sécurité** (auto-fin au plus tôt :
  FC atteinte *ou* temps écoulé), pas la cible principale.

### Syntaxe Markdown cible
```markdown
## Retour au calme
- cible_fc: max-40      # descend sous (FC max de la séance − 40)
- duree: 5min           # plafond de sécurité (filet si la FC ne descend pas)
- note: respire, 4s inspire / 6s expire
```
→ `target = { type: 'hr', mode: 'dynamic', delta: 40 }` (et `cap` = durée si fournie).

### Découpage
- **Lot A — Moteur (le « quoi »)** — *À FAIRE EN PREMIER, REPRENDRE ICI*
  - `session-parser.js` : prop `cible_fc:` → cible `hr` (+ `max-40` dynamique et
    valeur fixe). `duree` devient plafond quand la cible est `hr`.
  - `session-engine.js` : ajouter `pushHr()` (symétrique de `pushDistance()`, le
    `hr` existe déjà dans le bus normalisé) + gestion cible `hr` dans `checkSectionEnd`.
  - **Anti-rebond** : fin déclenchée seulement si FC ≤ seuil pendant ~3 s continues
    (éviter de couper la récup sur un sample bruité).
  - **`max` figé à l'entrée dans la section** (via recorder/bus), pas recalculé en
    direct sinon le seuil bouge sous les pieds de l'utilisateur.
  - `simulator.js` : faire **décroître la FC** dans une section `hr`, sinon l'écran
    n'est pas testable sans ceinture (cf. §5, engine testable en simulé).
- **Lot B — Écran « retour au calme » (le « comment »)**
  - Rendu spécial quand la section courante est de type `hr` : masquer les tuiles,
    afficher le **Breath Pacer** (cercle `@keyframes` CSS pur, 4 s inspire / 6 s
    expire, zéro `!important`) + **jauge FC rouge→vert** avec repère du seuil.
  - Gros bouton « terminer » (skip manuel) conservé, `cue()` sonore à l'atteinte.
  - **Sans ceinture FC connectée** : pas d'auto-fin → on s'appuie sur le plafond
    `duree` + skip manuel. À afficher clairement (« connecte ta ceinture »).
- **Lot C — Seuil personnalisé** *(optionnel, plus tard)* : mini-profil (âge →
  FCmax = 220−âge, ou FCmax saisie) dans le store → débloque `55%` / Karvonen.
- **Lot D — Résumé** *(optionnel)* : afficher la **Heart Rate Recovery** dans le
  summary (FC au début de la récup → temps pour repasser sous le seuil).

### État
- ⏳ **Lot A** : à démarrer (parser + engine + simulateur), validable en console/tests
  avant l'UI. Puis Lot B. Lots C/D à trancher plus tard.
