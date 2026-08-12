# 🚅 Eurostar Snap Alert (`eurostar-snap-alert`)

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-orange)](https://playwright.dev/)
[![Resend](https://img.shields.io/badge/Resend-Email-black)](https://resend.com/)

**eurostar-snap-alert** est une application automatisée en Node.js & TypeScript conçue pour surveiller la disponibilité des billets **Eurostar Snap** (trajet Londres St Pancras → Paris Gare du Nord, 1 adulte, dates cibles **2026-08-24** et **2026-08-25**) et envoyer des alertes e-mail immédiates via **Resend** dès qu'un trajet est disponible à la réservation.

---

## 🌟 Fonctionnalités

- 🔎 **Surveillance automatisée** : Vérification régulière des disponibilités pour les dates configurées.
- 🕒 **Intervalle aléatoire (60s - 90s)** : Évite d'effectuer des requêtes à intervalle strictement fixe pour un comportement plus naturel.
- 🧠 **Déduplication par SQLite** : Chaque combinaison `Date + Créneau horaire + Prix` n'est alertée qu'une seule fois. Si une nouvelle disponibilité apparaît plus tard, une nouvelle alerte est transmise.
- 📧 **Alertes e-mail HTML via Resend** : Notification immédiate avec tableau récapitulatif des billets et lien direct de réservation.
- 🛡️ **Gestion robuste des sélecteurs & Anti-Bot** :
  - Centralisation des sélecteurs dans `src/config.ts`.
  - Capture automatique d'écran (PNG) et export HTML dans le dossier `debug/` en cas de CAPTCHA, d'erreur ou d'échec de sélecteur.
  - Ne tente pas de contourner les CAPTCHA : loggue l'événement et retente calmement au cycle suivant.
- 🚫 **Sécurité** : N'effectue **aucune** transaction ni achat automatisé. Seules des alertes sont envoyées.
- 🧪 **Notifications de test & Mode DEBUG** : Commande `npm run test-email` pour valider la configuration e-mail.

---

## 🛠️ Stack Technique

- **Runtime** : Node.js (v20+) + TypeScript
- **Web Scraping** : Playwright (Chromium Headless)
- **Base de données** : SQLite (`better-sqlite3`) pour la persistance des alertes envoyées
- **E-mails** : Resend API (`resend`)
- **Conteneurisation** : Docker & Docker Compose

---

## 🚀 Installation & Lancement Local

### 1. Prérequis

- **Node.js** v20 ou supérieur
- **npm** v10 ou supérieur
- Un compte [Resend](https://resend.com) avec une clé d'API valide.

### 2. Cloner & Installer les dépendances

```bash
git clone https://github.com/votre-compte/eurostar-snap-alert.git
cd eurostar-snap-alert

# Installation des paquets Node.js
npm install

# Installation des navigateurs Playwright (Chromium)
npx playwright install chromium
```

### 3. Configuration des Variables d'Environnement

Copiez le fichier exemple `.env.example` vers `.env` et renseignez vos identifiants :

```bash
cp .env.example .env
```

Contenu du fichier `.env` :

```env
# Clé d'API Resend (obtenue sur https://resend.com)
RESEND_API_KEY=re_1234567890abcdef

# Adresses d'expéditeur et de destinataire
ALERT_FROM=Eurostar Snap Alert <onboarding@resend.dev>
ALERT_TO=votre-email@example.com

# Intervalle de vérification en secondes (délai aléatoire appliqué entre 60s et 90s)
CHECK_INTERVAL_SECONDS=75
HEADLESS=true
DEBUG=true
```

---

## 📋 Commandes Utiles

### 📧 Envoyer une alerte e-mail de test

Vérifiez que votre clé Resend et votre adresse de destinataire sont opérationnelles :

```bash
npm run test-email
```

### 🔍 Lancer une vérification unique (`check`)

Effectue un passage unique pour inspecter les 2 dates (`2026-08-24` et `2026-08-25`), envoyer un e-mail si un nouveau billet apparaît, enregistrer dans SQLite et s'arrêter :

```bash
npm run check
```

### 🔄 Lancer la boucle de surveillance continue (`start`)

Lance l'application en mode démon continu. Inspecte les deux dates à chaque cycle puis attend un délai aléatoire entre 60 et 90 secondes avant de recommencer :

```bash
npm run start
```

---

## ⚙️ Ajuster les Villes, Dates et Passagers

Toute la configuration métier est centralisée dans [`src/config.ts`](file:///c:/Users/victo/Documents/snap_eurostar/src/config.ts) :

```typescript
export const CONFIG: AppConfig = {
  // ...
  origin: '7015400',       // Code gare : 7015400 = Londres St Pancras International
  destination: '8727100',  // Code gare : 8727100 = Paris Gare du Nord
  dates: ['2026-08-24', '2026-08-25'], // Dates cibles au format YYYY-MM-DD
  adults: 1,               // Nombre d'adultes
};
```

### Codes gares Eurostar Snap fréquents :
- **Londres St Pancras Intl** : `7015400`
- **Paris Gare du Nord** : `8727100`
- **Bruxelles Midi** : `8814001`
- **Lille Europe** : `8722326`

---

## 🐳 Déploiement avec Docker

Vous pouvez facilement exécuter le bot dans un conteneur Docker.

### Lancer via Docker Compose

```bash
# Lancement en arrière-plan
docker-compose up -d --build

# Consulter les logs du conteneur
docker-compose logs -f
```

Les données SQLite (`./data`) et les captures de débogage (`./debug`) sont conservées sur votre hôte via des volumes Docker.

---

## ☁️ Guide de Déploiement sur un VPS ou Cloud

### 1. Sur un VPS (Ubuntu / Debian / PM2 / Docker)

1. Transférez le projet sur votre VPS.
2. Assurez-vous que Docker & Docker Compose sont installés.
3. Créez le fichier `.env` avec vos accès Resend.
4. Lancez `docker-compose up -d`.

*Option alternative sans Docker (via PM2) :*
```bash
npm install
npx playwright install-deps
npx playwright install chromium
npm run build
npx pm2 start dist/index.js --name "eurostar-snap-alert"
```

### 2. Sur Railway.app

1. Créez un nouveau projet sur **Railway**.
2. Connectez votre dépôt GitHub.
3. Railway détectera le `Dockerfile` à la racine.
4. Dans l'onglet **Variables**, ajoutez :
   - `RESEND_API_KEY`
   - `ALERT_FROM`
   - `ALERT_TO`
   - `HEADLESS=true`
5. Déployez le projet.

### 3. Sur Render.com

1. Créez un **Background Worker** ou **Web Service** sur Render.
2. Choisissez l'environnement **Docker**.
3. Définissez les variables d'environnement dans le tableau de bord Render.

### 4. Sur Fly.io

1. Lancez `fly launch` dans le répertoire du projet.
2. Configurez les secrets :
   ```bash
   fly secrets set RESEND_API_KEY="votre_cle" ALERT_FROM="votre_expediteur" ALERT_TO="votre_email"
   ```
3. Déployez avec `fly deploy`.

---

## 🐛 Mode Debug et Analyse des Problèmes

Lorsqu'un sélecteur ne renvoie rien ou si un CAPTCHA est rencontré, l'application génère automatiquement des artefacts dans le dossier `debug/` :

- `debug/debug_captcha_2026-08-24_<timestamp>.png` & `.html`
- `debug/debug_no_results_2026-08-24_<timestamp>.png` & `.html`

Ces captures permettent d'analyser l'état exact du DOM rendu par Eurostar Snap et de mettre à jour les sélecteurs dans `src/config.ts` sans interrompre la surveillance.

---

## 📜 Licence

Projet open-source sous licence ISC.
