# CLAUDE.md — SEO Editorial Planner

> Fichier mémoire projet — à placer à la racine du repo.
> Permet à Claude de reprendre le contexte exact à chaque session.

---

## 1. Ce qu'est ce projet

**SEO Editorial Planner** est un outil web qui transforme deux fichiers CSV (Google Keyword Planner + Ahrefs) en planning éditorial SEO complet — **une ligne par page**, avec regroupement des keywords, enrichissement SEMrush, et calcul de trafic incrémental.

- **URL de prod** : https://content-planning-seo-tool.vercel.app/
- **Repo GitHub** : github.com/tlb-dtw/seo-editorial-planner
- **Client** : Datawords — usage interne équipe SEO
- **Statut** : V1 déployée

### Proposition de valeur

| Avant | Après |
|---|---|
| 2–3 jours consultant SEO | < 1 heure + 30 min relecture |
| Unité = keyword | Unité = **page** (clustering automatique) |
| Intention devinée sémantiquement | Intention réelle via SEMrush API |
| Trafic estimé par keyword | Trafic agrégé par page (KW principal + secondaires) |

---

## 2. Architecture technique

### Stack

```
Frontend       : HTML / CSS / JS vanilla (pas de framework)
Build          : Vite 5
Hosting        : Vercel (plan Hobby — gratuit)
IA             : Claude Haiku via API Anthropic (catégorisation + clustering GAP)
SEO data       : SEMrush API phrase_this (intention réelle, format SERP)
Proxy API      : Vercel Serverless Functions (api/claude.js + api/semrush.js)
Données        : 100% navigateur — aucune persistance serveur
```

### Structure des fichiers

```
seo-editorial-planner/
├── index.html
├── vite.config.js
├── vercel.json                  # Sans bloc "functions" — bug Vercel connu
├── package.json
├── api/
│   ├── claude.js                # Proxy Anthropic (CORS fix)
│   └── semrush.js               # Proxy SEMrush (CORS fix)
└── src/
    ├── main.js                  # State machine + UI complète
    ├── styles/main.css          # Design system dark / industrial
    └── lib/
        ├── csvParser.js         # Parser multi-format avec détection colonnes
        ├── anthropicClient.js   # Catégorisation via /api/claude
        ├── semrushClient.js     # Enrichissement via /api/semrush
        ├── pageClustering.js    # Regroupement keywords → pages
        ├── scoring.js           # Trafic incrémental (Priority Score supprimé)
        └── exportCSV.js         # Export CSV une ligne/page
```

---

## 3. Flux de traitement

```
Fichier 1 (KP)      Fichier 2 (Ahrefs)
     │                     │
     ▼                     ▼
  csvParser            csvParser
  type:'kp'           type:'ahrefs'
     │                     │
  deduplicate         buildAhrefsIndex
     │                     │
     └──────────┬──────────┘
                ▼
       Claude Haiku (lots de 40)
       → intent, serp, trend, difficulty, title, cluster
                │
                ▼
       pageClustering.js
       PASS 1 : grouper par URL Ahrefs (keywords positionnés sur même URL)
       PASS 2 : clustering sémantique GAP (par topic cluster Claude)
       PASS 3 : identifier KW principal (volume max) + calcul métriques agrégées
                │
                ▼
       SEMrush phrase_this (optionnel)
       → écrase intent + serpFormat sur les KW principaux uniquement
                │
                ▼
       renderTable() + exportPagesToCSV()
       1 ligne = 1 page
```

---

## 4. Format CSV d'entrée

### Fichier 1 — Keyword Planner

| Col A | Col B |
|---|---|
| Mot-clé | Volume mensuel |

### Fichier 2 — Ahrefs (deux formats auto-détectés)

**Format A — standard** : `Keyword | Volume | Position | URL`
**Format B — testé Guardian Glass** : `Keywords | Ranking US | US vol | URL US`

> Détection via noms de colonnes dans le header. Valeurs `-` et `#N/A` normalisées en vide.

---

## 5. Format CSV de sortie — une ligne par page

| Colonne | Source |
|---|---|
| Action | Règles métier (position) |
| URL | Ahrefs (vide si GAP) |
| Topic cluster | Claude (sémantique) |
| Mot-clé principal | KW avec volume max dans la page |
| Volume KW principal | Fichier source |
| Position KW principal | Ahrefs |
| Mots-clés secondaires | Autres KW de la page (séparés par \|) |
| Volume cumulé KW secondaires | Somme des volumes secondaires |
| Nb KW positionnés sur l'URL | Count Ahrefs |
| Trafic actuel estimé (agrégé) | Σ trafic de tous les KW de la page |
| Trafic max estimé (agrégé) | Σ trafic max (pos.1) tous KW |
| Trafic incrémental max (agrégé) | Trafic max - Trafic actuel |
| Intention | SEMrush (si activé) ou Claude |
| Format SERP | SEMrush (si activé) ou Claude |
| Titre | Claude (existant ou proposé) |

---

## 6. Logique de clustering en pages (pageClustering.js)

**PASS 1 — URL Ahrefs** : tous les keywords positionnés sur la même URL sont regroupés en une page. La clé de regroupement est l'URL normalisée (lowercase, sans trailing slash).

**PASS 2 — Clustering sémantique GAP** : les keywords sans URL (GAP) sont regroupés par `cluster` détecté par Claude. La clé = `GAP::nom_du_cluster`.

**PASS 3 — Métriques par page** :
- KW principal = celui avec le volume le plus élevé
- KW secondaires = tous les autres, triés par volume
- `kwPositionnedCount` = nb de KW avec une position dans Ahrefs
- Trafic agrégé = somme des trafics de TOUS les KW de la page

---

## 7. Règles d'action

| Position Ahrefs | Statut | Action |
|---|---|---|
| Absent du fichier Ahrefs | GAP | Create |
| 1–3 | OK | Keep & Monitor |
| 4–10 | OK | Quick Win |
| 11–20 | OK | Structural Boost |
| > 20 | OK | Full Rewrite |
| Même KW sur 2+ URLs | RISK | Merge + 301 |

---

## 8. Trafic incrémental

```
CTR par position :
  1→10% | 2→7% | 3→5% | 4→3% | 5→2% | 6→1.5% | 7→1% | 8→0.7% | 9→0.5% | 10→0.3%
  > 10 : CTR décroissant (CTR_pos10 × 10 / pos), plancher 0.1%

Trafic actuel   = volume × CTR_position_actuelle
Trafic max      = volume × 10% (CTR pos.1)
Trafic incrém.  = trafic_max − trafic_actuel
GAP             : trafic_actuel = 0, trafic_incrém. = volume × 10%

Calcul agrégé par page = Σ sur tous les KW de la page (principal + secondaires)
```

**Priority Score supprimé** — la priorisation se fait uniquement par trafic incrémental.

---

## 9. SEMrush API (api/semrush.js)

- **Endpoint** : `phrase_this`
- **Colonnes exportées** : `Ph,Nq,Kd,Cp,Co,In,Tr,Sf`
- **Appels** : uniquement sur les KW principaux (après clustering) — pas sur tous les keywords
- **Mapping intent** : 0=Informationnel, 1=Navigationnel, 2=Commercial, 3=Transactionnel
- **Mapping SERP format** : shopping→plp, featured_snippet→faq, local→landing, video→hub, default→article
- **Fallback** : si erreur SEMrush, on garde les valeurs estimées par Claude
- **Coût estimé** : nb_pages × 0,008$ (bien moins que nb_keywords)

---

## 10. Bugs résolus

| Bug | Cause | Fix |
|---|---|---|
| CORS / Failed to fetch | Anthropic bloque les appels navigateur | api/claude.js proxy Vercel |
| Colonnes CSV inversées | Export Ahrefs = Ranking\|Volume (pas Volume\|Position) | detectAhrefsColumns() dans csvParser.js |
| Vercel build error "Function Runtimes" | Bloc `"functions"` invalide dans vercel.json | Supprimé — runtime auto-détecté |
| Résultats vides (0 keywords) | Navigation step 4 avant fin async | setTimeout 600ms après résolution |
| Toutes actions "Full Rewrite" | Positions non lues + valeurs `-` non gérées | Nettoyage `-` et `#N/A` dans parser |

---

## 11. Point d'attention vercel.json

**Ne jamais remettre le bloc `"functions"`** :
```json
// ✗ INVALIDE — cause "Function Runtimes must have a valid version"
"functions": { "api/*.js": { "runtime": "nodejs20.x" } }
```
Vercel détecte automatiquement le runtime Node.js pour les fichiers dans `/api/`.

---

## 12. Roadmap

### V2
- [ ] Lemmatisation + déduplication fuzzy (Levenshtein > 85%)
- [ ] Intégration Google Analytics (taux de conversion → valeur commerciale réelle)
- [ ] Cannibalisation sémantique (embedding JS)
- [ ] Onglet maillage interne Mère/Filles

### V3
- [ ] Intégration API SERP live (DataForSEO / SerpAPI)
- [ ] Clustering SERP-based (Jaccard index sur top 10 résultats)
- [ ] Share of Voice concurrentiel

---

## 13. Fichiers de test validés

| Fichier | Format | Keywords | Statut |
|---|---|---|---|
| Export Guardian Glass | `Keywords, Ranking US, US vol, URL US` | 941 | ✓ Validé |

---

*Maintenu par l'équipe SEO Datawords — mettre à jour après chaque sprint*
