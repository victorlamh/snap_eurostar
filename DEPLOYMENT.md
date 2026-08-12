# 🚀 Guide de Déploiement 24/7 & Configuration Telegram

Ce document explique comment déployer l'application **Eurostar Snap Alert** pour qu'elle s'exécute **en continu 24h/24 dans le Cloud**, gratuitement ou à moindre coût, sans laisser votre ordinateur allumé.

---

## 📱 Option 1 : Hébergement Cloud Gratuit sur Render.com (Recommandé)

[Render.com](https://render.com) permet de déployer un conteneur Docker gratuitement.

### Étape 1 : Publier votre projet sur GitHub
1. Créez un dépôt sur [GitHub](https://github.com/new) (privé ou public).
2. Poussez le code de votre dossier `snap_eurostar` sur GitHub :
   ```bash
   git init
   git add .
   git commit -m "Initialisation Eurostar Snap Alert"
   git branch -M main
   git remote add origin https://github.com/votre-compte/snap_eurostar.git
   git push -u origin main
   ```

### Étape 2 : Connecter à Render.com
1. Créez un compte gratuit sur [Render.com](https://dashboard.render.com/register) (connectez-vous directement via GitHub).
2. Cliquez sur **New +** &rarr; **Web Service**.
3. Sélectionnez votre dépôt GitHub `snap_eurostar`.
4. Dans la configuration :
   - **Environment** : `Docker`
   - **Region** : Frankfurt (Europe)
   - **Instance Type** : `Free` ou `Starter`
5. Cliquez sur **Create Web Service**.

Render va automatiquement construire votre conteneur Docker (Node.js + Playwright Chromium) et générer votre URL web (ex: `https://eurostar-snap-xxxx.onrender.com`).

---

## 💬 Option 2 : Configurer les Notifications Telegram

Pour recevoir des alertes push directement sur votre smartphone dès qu'un billet s'ouvre :

### 1. Obtenir un Bot Token
1. Sur Telegram, cherchez le bot officiel `@BotFather`.
2. Envoyez la commande `/newbot`.
3. Donnez un nom (ex: `MonBotEurostar`) et un nom d'utilisateur (ex: `MonBotEurostar_bot`).
4. `@BotFather` vous donne un **HTTP API Token** (ex: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

### 2. Obtenir votre Chat ID
1. Cherchez le bot `@userinfobot` sur Telegram et cliquez sur **Start**.
2. Il vous répond avec votre `Id` numérique (ex: `987654321`).

### 3. Configurer dans le Dashboard Web
1. Ouvrez votre Dashboard Web (ex: `http://localhost:3000` ou votre URL Render).
2. Dans la section **Alertes Telegram Instantanées** :
   - Collez le **Bot Token**
   - Collez le **Chat ID**
   - Cochez l'interrupteur
3. Cliquez sur **Enregistrer la Configuration**, puis sur **Test Telegram**. Vous devez recevoir immédiatement un message sur Telegram !

---

## 🐳 Option 3 : Déploiement Docker en Local ou VPS

Si vous disposez d'un serveur chez vous (NAS Synology, Raspberry Pi, VPS) :
```bash
docker-compose up -d --build
```
L'application sera accessible sur `http://IP_DE_VOTRE_SERVEUR:3000`.
