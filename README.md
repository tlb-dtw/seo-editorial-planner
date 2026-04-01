# SEO Editorial Planner — V1

> Transforme deux exports CSV (Keyword Planner + Ahrefs) en planning éditorial SEO complet, priorisé et actionnable — en moins d'une heure, pour moins de 10 €.

## Demo live

→ [https://content-planning-seo-tool.vercel.app/](https://content-planning-seo-tool.vercel.app/)

---

## Ce que fait l'outil

| Livrable | Détail |
|---|---|
| Catégorisation enrichie | Intention, format SERP, PAA, tendance, difficulté — via Claude Haiku |
| Audit gaps & cannibalisation | Statuts [GAP] / [OK] / [RISK] croisés avec les positions Ahrefs |
| Planning éditorial actionnable | 7 types d'action selon la position : Create, Quick Win, Keep & Monitor, Structural Boost, Full Rewrite, Merge + 301, De-optimize |
| Scoring | Priority Score (100 pts) + Opportunity Score (trafic potentiel estimé) |
| Export CSV | Toutes les données, prêt à importer dans Google Sheets |

---

## Format des fichiers d'entrée

**Fichier 1 — Keywords + Volumes (Keyword Planner)**

| Colonne A | Colonne B |
|---|---|
| Mot-clé | Volume mensuel |

**Fichier 2 — Positions Ahrefs**

| Colonne A | Colonne B | Colonne C | Colonne D |
|---|---|---|---|
| Mot-clé | Volume | Position | URL positionnée |

> L'outil détecte automatiquement le séparateur (virgule, point-virgule, tabulation) et ignore la ligne d'en-tête si présente.

---

## Stack technique

- **Frontend** : HTML / CSS / JS vanilla — zéro framework
- **Build** : Vite 5
- **Hosting** : Vercel (déploiement auto sur push `main`)
- **IA** : Claude Haiku via API Anthropic (catégorisation)
- **Données** : traitement 100% navigateur, aucune donnée stockée côté serveur

---

## Déploiement — Guide pas à pas

### Prérequis

- Compte [GitHub](https://github.com) (gratuit)
- Compte [Vercel](https://vercel.com) lié à GitHub (gratuit)
- Clé API Anthropic — [console.anthropic.com](https://console.anthropic.com) → API Keys

### Étape 1 — Créer le repo GitHub

```bash
# Sur github.com : New repository
# Nom suggéré : seo-editorial-planner
# Visibilité : Private (recommandé — prompts et logique métier inclus)
```

### Étape 2 — Cloner et pousser le code

```bash
# Cloner le repo vide
git clone https://github.com/VOTRE-ORG/seo-editorial-planner.git
cd seo-editorial-planner

# Copier tous les fichiers du projet dans ce dossier
# puis :

git add .
git commit -m "feat: initial V1 deployment"
git push origin main
```

### Étape 3 — Connecter Vercel

1. Aller sur [vercel.com](https://vercel.com) → **Add New Project**
2. Importer le repo `seo-editorial-planner` depuis GitHub
3. Vercel détecte automatiquement Vite — **aucune configuration manuelle requise**
4. Cliquer **Deploy**

Le déploiement prend ~60 secondes. Vercel fournit une URL `https://seo-editorial-planner-xxxx.vercel.app`.

### Étape 4 — Domaine personnalisé (optionnel)

Dans Vercel : **Settings → Domains** → ajouter votre domaine.

### Déploiements suivants

Tout push sur `main` déclenche automatiquement un nouveau déploiement Vercel.

```bash
git add .
git commit -m "feat: amélioration scoring"
git push origin main
# → déploiement automatique en ~60s
```

---

## Développement local

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
# → http://localhost:5173

# Build de production
npm run build

# Prévisualiser le build
npm run preview
```

---

## Structure du projet

```
seo-editorial-planner/
├── index.html                  # Point d'entrée HTML
├── vite.config.js              # Config Vite
├── vercel.json                 # Config déploiement Vercel
├── package.json
├── .gitignore
├── README.md
└── src/
    ├── main.js                 # App principale — state machine + UI
    ├── styles/
    │   └── main.css            # Design system complet
    └── lib/
        ├── csvParser.js        # Parsing CSV robuste (multi-séparateurs)
        ├── anthropicClient.js  # Appels API Anthropic (Haiku)
        ├── scoring.js          # Priority Score + Opportunity Score
        └── exportCSV.js        # Export CSV avec BOM UTF-8
```

---

## Coûts opérationnels

| Poste | Coût |
|---|---|
| Hébergement Vercel | Gratuit (plan Hobby) |
| Claude Haiku — catégorisation | ~0,001 € / 40 keywords |
| Coût par analyse (1 000 kw) | ~0,025 € |
| Coût par analyse (5 000 kw) | ~0,125 € |

> Budget recommandé pour démarrer : 50 € de crédits API Anthropic.

---

## Roadmap

| Version | Fonctionnalités |
|---|---|
| **V1 (actuel)** | Import CSV · Catégorisation Haiku · Priority/Opportunity Score · Export CSV |
| **V2** | Scoring avec données GA · Topic Clusters · Maillage interne · Cannibalisation sémantique |
| **V3** | Intégration API SERP · Similarité inter-keywords · Share of Voice concurrentiel |

---

## Sécurité

- La clé API Anthropic est saisie dans le navigateur et utilisée directement depuis le client
- **Elle n'est jamais transmise à un serveur tiers, jamais stockée**
- Les données des fichiers CSV sont traitées exclusivement en mémoire navigateur
- Aucune persistance, aucun cookie, aucun tracking

---

*Document confidentiel — Usage interne Datawords*
