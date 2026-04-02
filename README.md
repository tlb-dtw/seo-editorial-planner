# Outil Études Sémantiques

Application web pour mener des études sémantiques SEO structurées en 3 blocs.

## Fonctionnalités

- **Bloc 1 — Matrice** : Définir le terme générique, créer les angles sémantiques avec scores de poids, renseigner les termes
- **Bloc 2 — Requêtes** : Définir des schémas de croisement, matrice de compatibilité entre angles, génération automatique des mots-clés
- **Bloc 3 — Priorisation** : Saisie des volumes, calcul du cumul et % de couverture, export CSV

## Installation locale

```bash
npm install

# Terminal 1 — proxy API (évite les erreurs CORS)
node dev-proxy.js

# Terminal 2 — app React
npm run dev
```

## Déploiement GitHub + Vercel

### 1. Créer le repo GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/semantic-tool.git
git push -u origin main
```

### 2. Déployer sur Vercel

1. Aller sur [vercel.com](https://vercel.com)
2. "Add New Project" → importer le repo GitHub
3. Vercel détecte automatiquement Vite
4. Cliquer "Deploy"

Le déploiement est automatique à chaque `git push` sur `main`.

## Stack

- React 18
- Vite 5
- CSS Modules (zéro dépendance UI)
