import { parseCSV, deduplicateKeywords, normalizeKeyword } from './lib/csvParser.js';
import { buildAhrefsIndex, scoreResults } from './lib/scoring.js';
import { categorizeBatch, createFallbackBatch, sleep } from './lib/anthropicClient.js';
import { exportToCSV } from './lib/exportCSV.js';

// ── STATE ────────────────────────────────────────────────────
const state = {
  step: 1,
  kpData: [],
  ahrefsData: [],
  results: [],
  filtered: [],
  sortCol: 'priorityScore',
  sortDir: 'desc',
  abortController: null,
  filters: { status: '', action: '', intent: '', search: '' },
};

// ── INIT ─────────────────────────────────────────────────────
document.getElementById('app').innerHTML = buildHTML();
bindEvents();
setStep(1);

// ── HTML SKELETON ────────────────────────────────────────────
function buildHTML() {
  return `
    <header class="app-header">
      <div class="header-brand">
        <h1>SEO Editorial Planner</h1>
        <span class="version-tag">V1</span>
      </div>
      <nav class="header-nav">
        ${['Import', 'Config', 'Analyse', 'Résultats'].map((l, i) => `
          <div class="nav-step" id="nav-${i+1}">
            <span class="step-num">${i+1}</span>
            <span class="nav-step-label">${l}</span>
          </div>`).join('')}
      </nav>
    </header>

    <main class="app-main">
      <!-- STEP 1 -->
      <div class="section" id="sec1">
        <div class="step1-layout">
          <div class="step1-left">
            <div class="step1-eyebrow">Outil d'analyse SEO</div>
            <h2 class="step1-title">Du CSV brut au <span>planning éditorial</span> en moins d'une heure</h2>
            <p class="step1-desc">
              Importez vos exports Keyword Planner et Ahrefs. L'outil croise les données,
              catégorise chaque keyword par intention et format SERP, détecte les gaps et
              cannibalisations, et génère un planning priorisé avec Priority Score et Opportunity Score.
            </p>
            <div class="stat-row">
              <div class="stat-item">
                <span class="stat-num">9</span>
                <span class="stat-label">dimensions / keyword</span>
              </div>
              <div class="stat-item">
                <span class="stat-num">7</span>
                <span class="stat-label">types d'action</span>
              </div>
              <div class="stat-item">
                <span class="stat-num">&lt;10€</span>
                <span class="stat-label">par analyse</span>
              </div>
            </div>
          </div>
          <div class="step1-right">
            ${buildUploadCard(1, 'Keywords + Volumes', 'Export Google Keyword Planner', [
              {label:'A — Mot-clé', req:true}, {label:'B — Volume', req:true}
            ])}
            ${buildUploadCard(2, 'Positions Ahrefs', 'Export Ahrefs Keywords Explorer', [
              {label:'A — Mot-clé', req:true}, {label:'B — Volume', req:true},
              {label:'C — Position', req:true}, {label:'D — URL', req:false}
            ])}
          </div>
        </div>
        <div class="step1-footer">
          <div class="loaded-summary" id="loadedSummary">Importez les deux fichiers pour continuer</div>
          <button class="btn btn-primary" id="btnStep2" disabled onclick="goStep(2)">
            Configurer l'analyse →
          </button>
        </div>
      </div>

      <!-- STEP 2 -->
      <div class="section" id="sec2">
        <div class="step2-layout">
          <h2 class="config-title">Configuration</h2>
          <p class="config-sub">Paramètres de l'analyse — la clé API n'est jamais stockée ni transmise hors de votre navigateur.</p>

          <div class="config-section">
            <div class="config-section-header">
              <span class="config-section-label">Anthropic API</span>
            </div>
            <div class="config-section-body">
              <div class="field">
                <label>Clé API</label>
                <div class="key-row">
                  <input type="password" id="apikey" placeholder="sk-ant-api03-..." autocomplete="off" spellcheck="false">
                  <button class="btn btn-sm" onclick="toggleKey()">Afficher</button>
                </div>
                <span class="field-hint">Obtenez votre clé sur <a href="https://console.anthropic.com" target="_blank" style="color:var(--accent)">console.anthropic.com</a> → API Keys</span>
              </div>
            </div>
          </div>

          <div class="config-section">
            <div class="config-section-header">
              <span class="config-section-label">Paramètres d'analyse</span>
            </div>
            <div class="config-section-body">
              <div class="field-row">
                <div class="field">
                  <label>Langue des données</label>
                  <select id="lang">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
                <div class="field">
                  <label>Taille des lots API</label>
                  <select id="batchSize">
                    <option value="25">25 — prudent (moins d'erreurs)</option>
                    <option value="40" selected>40 — recommandé</option>
                    <option value="60">60 — rapide</option>
                  </select>
                </div>
              </div>
              <div class="field">
                <label>Business Relevance par défaut (Priority Score)</label>
                <div class="range-row">
                  <input type="range" min="1" max="5" value="3" step="1" id="bizRel">
                  <span class="range-val" id="bizRelVal">3</span>
                  <span style="font-size:11px;color:var(--text-3)">/ 5 — pondération business dans le scoring</span>
                </div>
                <span class="field-hint">Peut être affiné keyword par keyword via un export GA (V2)</span>
              </div>
            </div>
          </div>

          <div class="config-footer">
            <button class="btn btn-ghost" onclick="goStep(1)">← Retour</button>
            <button class="btn btn-primary" id="btnLaunch" onclick="goStep(3)">
              Lancer l'analyse →
            </button>
          </div>
        </div>
      </div>

      <!-- STEP 3 -->
      <div class="section" id="sec3">
        <div class="step3-layout">
          <div class="analysis-header">
            <div class="analysis-label">En cours</div>
            <h2 class="analysis-title">Analyse des keywords</h2>
          </div>
          <div class="progress-status">
            <span id="progressMsg">Initialisation...</span>
            <span class="progress-pct" id="progressPct">0%</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" id="progressBar" style="width:0%"></div>
          </div>
          <div class="log-console" id="logConsole"></div>
          <div class="abort-row">
            <button class="btn btn-sm" id="btnAbort" onclick="abortAnalysis()">Annuler</button>
          </div>
        </div>
      </div>

      <!-- STEP 4 -->
      <div class="section" id="sec4">
        <div class="step4-layout">
          <div class="results-toolbar">
            <div class="metrics-strip" id="metricsStrip"></div>
            <div class="filter-group">
              <select class="filter-select" id="fStatus" onchange="applyFilters()">
                <option value="">Tous statuts</option>
                <option value="GAP">GAP</option>
                <option value="OK">OK</option>
                <option value="RISK">RISK</option>
              </select>
              <select class="filter-select" id="fAction" onchange="applyFilters()">
                <option value="">Toutes actions</option>
                <option value="Create">Create</option>
                <option value="Quick Win">Quick Win</option>
                <option value="Keep & Monitor">Keep &amp; Monitor</option>
                <option value="Structural Boost">Structural Boost</option>
                <option value="Full Rewrite">Full Rewrite</option>
                <option value="Merge + 301">Merge + 301</option>
                <option value="De-optimize">De-optimize</option>
              </select>
              <select class="filter-select" id="fIntent" onchange="applyFilters()">
                <option value="">Toutes intentions</option>
                <option value="Transactionnel">Transactionnel</option>
                <option value="Commercial">Commercial</option>
                <option value="Informationnel">Informationnel</option>
                <option value="Navigationnel">Navigationnel</option>
              </select>
              <input type="text" class="search-input" id="fSearch" placeholder="Rechercher un mot-clé..." oninput="applyFilters()">
            </div>
            <div class="toolbar-right">
              <button class="btn btn-sm" onclick="exportResults()">Export CSV</button>
              <button class="btn btn-sm btn-ghost" onclick="goStep(1)">Nouvelle analyse</button>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="sortable" style="width:20%" onclick="sortBy('keyword')" id="th-keyword">Mot-clé</th>
                  <th class="sortable" style="width:8%" onclick="sortBy('volume')" id="th-volume">Volume</th>
                  <th style="width:13%">Intention</th>
                  <th style="width:8%">Statut</th>
                  <th style="width:15%">Action</th>
                  <th class="sortable" style="width:7%" onclick="sortBy('position')" id="th-position">Pos.</th>
                  <th class="sortable" style="width:8%" onclick="sortBy('priorityScore')" id="th-priorityScore">P.Score</th>
                  <th class="sortable" style="width:8%" onclick="sortBy('opportunityScore')" id="th-opportunityScore">O.Score</th>
                  <th style="width:13%">Cluster</th>
                </tr>
              </thead>
              <tbody id="resultsTbody"></tbody>
            </table>
          </div>

          <div class="table-footer">
            <span id="rowCount">—</span>
            <span style="color:var(--text-3)">Trié par Priority Score — Export CSV = données complètes</span>
          </div>
        </div>
      </div>
    </main>
  `;
}

function buildUploadCard(num, title, sub, cols) {
  const schema = cols.map(c =>
    `<span class="schema-col ${c.req ? 'required' : ''}">${c.label}</span>`
  ).join('');
  return `
    <div class="upload-card">
      <div class="upload-card-header">
        <div class="upload-card-num">${num}</div>
        <div>
          <div class="upload-card-title">${title}</div>
        </div>
        <div class="upload-card-sub">${sub}</div>
      </div>
      <div class="upload-schema">${schema}</div>
      <div class="drop-zone" id="drop${num}" onclick="document.getElementById('file${num}').click()">
        <div class="drop-zone-icon">↑</div>
        <div class="drop-zone-label" id="dz${num}label">Cliquer ou glisser le fichier CSV</div>
        <div class="drop-zone-meta" id="dz${num}meta">.csv · séparateurs , ; ou tab</div>
      </div>
      <input type="file" id="file${num}" accept=".csv,.txt" style="display:none">
      <div class="file-preview" id="prev${num}"></div>
      <div class="upload-error" id="err${num}"></div>
    </div>
  `;
}

// ── EVENTS ───────────────────────────────────────────────────
function bindEvents() {
  setupUpload(1);
  setupUpload(2);
  document.getElementById('bizRel').addEventListener('input', e => {
    document.getElementById('bizRelVal').textContent = e.target.value;
  });
}

function setupUpload(num) {
  const inp = document.getElementById(`file${num}`);
  const dz = document.getElementById(`drop${num}`);

  const handleFile = file => {
    if (!file) return;
    clearUploadError(num);
    const reader = new FileReader();
    reader.onload = e => processFile(e.target.result, num, file.name);
    reader.onerror = () => showUploadError(num, 'Impossible de lire le fichier');
    reader.readAsText(file, 'UTF-8');
  };

  inp.addEventListener('change', () => handleFile(inp.files[0]));
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--accent-dim)'; });
  dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.style.borderColor = '';
    handleFile(e.dataTransfer.files[0]);
  });
}

function processFile(text, num, filename) {
  try {
    const expectedCols = num === 1 ? 2 : 4;
    const { rows } = parseCSV(text, expectedCols);

    if (rows.length === 0) throw new Error('Aucune ligne valide. Vérifiez le format du fichier.');

    if (num === 1) state.kpData = rows;
    else state.ahrefsData = rows;

    // Update UI
    document.getElementById(`drop${num}`).classList.add('loaded');
    document.getElementById(`dz${num}label`).textContent = filename;
    document.getElementById(`dz${num}meta`).textContent = `${rows.length.toLocaleString('fr-FR')} keywords chargés`;

    // Preview
    const prev = document.getElementById(`prev${num}`);
    prev.classList.add('show');
    prev.textContent = `Aperçu — ${rows.slice(0, 3).map(r => r.slice(0, 4).join(' | ')).join('  ·  ')}`;

    updateStep1Footer();
  } catch (err) {
    showUploadError(num, err.message);
  }
}

function showUploadError(num, msg) {
  const el = document.getElementById(`err${num}`);
  el.textContent = '✗ ' + msg;
  el.classList.add('show');
}

function clearUploadError(num) {
  document.getElementById(`err${num}`).classList.remove('show');
}

function updateStep1Footer() {
  const both = state.kpData.length > 0 && state.ahrefsData.length > 0;
  document.getElementById('btnStep2').disabled = !both;
  if (both) {
    document.getElementById('loadedSummary').innerHTML =
      `Fichier 1 : <span>${state.kpData.length.toLocaleString('fr-FR')} kw</span> &nbsp;·&nbsp; Fichier 2 : <span>${state.ahrefsData.length.toLocaleString('fr-FR')} positions</span>`;
  }
}

// ── NAVIGATION ───────────────────────────────────────────────
function setStep(n) {
  [1,2,3,4].forEach(i => {
    document.getElementById(`sec${i}`).classList.remove('visible');
    const nav = document.getElementById(`nav-${i}`);
    nav.classList.remove('active', 'done');
    if (i < n) nav.classList.add('done');
  });
  document.getElementById(`sec${n}`).classList.add('visible');
  document.getElementById(`nav-${n}`).classList.add('active');
  state.step = n;
}

window.goStep = function(n) {
  if (n === 3) {
    const key = document.getElementById('apikey').value.trim();
    if (!key) { alert('Veuillez entrer votre clé API Anthropic.'); return; }
    startAnalysis();
  }
  setStep(n);
};

window.toggleKey = function() {
  const inp = document.getElementById('apikey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
};

// ── ANALYSIS ─────────────────────────────────────────────────
async function startAnalysis() {
  state.abortController = new AbortController();
  const { signal } = state.abortController;
  const apiKey = document.getElementById('apikey').value.trim();
  const lang = document.getElementById('lang').value;
  const bizRel = parseInt(document.getElementById('bizRel').value);
  const BATCH = parseInt(document.getElementById('batchSize').value);

  const logEl = document.getElementById('logConsole');
  logEl.innerHTML = '';

  const log = (msg, type = 'info') => {
    logEl.innerHTML += `<span class="log-${type}">${msg}</span><br>`;
    logEl.scrollTop = logEl.scrollHeight;
  };

  const setProgress = (pct, msg) => {
    document.getElementById('progressBar').style.width = Math.min(pct, 100) + '%';
    document.getElementById('progressMsg').textContent = msg;
    document.getElementById('progressPct').textContent = Math.round(pct) + '%';
  };

  try {
    log(`▶ Démarrage — ${state.kpData.length} kw source · ${state.ahrefsData.length} positions Ahrefs`, 'accent');
    setProgress(5, 'Nettoyage et déduplication...');

    const cleaned = deduplicateKeywords(state.kpData);
    log(`Nettoyage : ${state.kpData.length} → ${cleaned.length} keywords (${state.kpData.length - cleaned.length} doublons)`);

    const ahrefsMap = buildAhrefsIndex(state.ahrefsData);
    log(`Index Ahrefs : ${Object.keys(ahrefsMap).length} entrées indexées`);

    const batches = [];
    for (let i = 0; i < cleaned.length; i += BATCH) batches.push(cleaned.slice(i, i + BATCH));
    log(`${batches.length} lots de ~${BATCH} keywords → modèle Claude Haiku`);
    setProgress(10, 'Catégorisation en cours...');

    let categorized = [];
    let errorCount = 0;

    for (let b = 0; b < batches.length; b++) {
      if (signal.aborted) { log('⚠ Analyse annulée', 'err'); break; }

      const pct = 10 + ((b / batches.length) * 68);
      setProgress(pct, `Lot ${b + 1} / ${batches.length}`);
      log(`→ Lot ${b + 1}/${batches.length} · ${batches[b].length} kw`);

      try {
        const res = await categorizeBatch(batches[b], lang, apiKey, signal);
        categorized = categorized.concat(res);
        log(`  ✓ ${res.length} catégorisés`, 'ok');
      } catch (err) {
        if (err.name === 'AbortError') break;
        errorCount++;
        log(`  ✗ ${err.message.substring(0, 100)}`, 'err');
        // Fallback: keep keywords with default values
        categorized = categorized.concat(createFallbackBatch(batches[b]));
        log(`  → Fallback appliqué (${batches[b].length} kw conservés)`, 'info');
      }

      if (b < batches.length - 1) await sleep(350);
    }

    setProgress(82, 'Calcul des scores...');
    log('Calcul Priority Score & Opportunity Score...', 'accent');

    state.results = scoreResults(categorized, ahrefsMap, bizRel);
    state.filtered = [...state.results];

    const gap = state.results.filter(r => r.status === 'GAP').length;
    const ok = state.results.filter(r => r.status === 'OK').length;
    const risk = state.results.filter(r => r.status === 'RISK').length;

    setProgress(100, 'Analyse terminée');
    log('');
    log(`✓ ${state.results.length} keywords analysés${errorCount ? ` (${errorCount} lots en mode fallback)` : ''}`, 'ok');
    log(`GAP : ${gap}  ·  OK : ${ok}  ·  RISK : ${risk}`, 'accent');

    setTimeout(() => {
      setStep(4);
      renderMetrics();
      renderTable();
    }, 600);

  } catch (err) {
    if (err.name !== 'AbortError') {
      log(`Erreur fatale : ${err.message}`, 'err');
    }
  }
}

window.abortAnalysis = function() {
  if (state.abortController) state.abortController.abort();
};

// ── RESULTS ──────────────────────────────────────────────────
function renderMetrics() {
  const r = state.results;
  const gap = r.filter(x => x.status === 'GAP').length;
  const ok = r.filter(x => x.status === 'OK').length;
  const risk = r.filter(x => x.status === 'RISK').length;
  const avgPS = r.length ? Math.round(r.reduce((a, x) => a + x.priorityScore, 0) / r.length) : 0;

  document.getElementById('metricsStrip').innerHTML = `
    <div class="metric-pill m-total">
      <span class="metric-pill-val">${r.length}</span>
      <span class="metric-pill-lbl">Total</span>
    </div>
    <div class="metric-pill m-gap">
      <span class="metric-pill-val">${gap}</span>
      <span class="metric-pill-lbl">GAP</span>
    </div>
    <div class="metric-pill m-ok">
      <span class="metric-pill-val">${ok}</span>
      <span class="metric-pill-lbl">OK</span>
    </div>
    <div class="metric-pill m-risk">
      <span class="metric-pill-val">${risk}</span>
      <span class="metric-pill-lbl">RISK</span>
    </div>
    <div class="metric-pill m-score">
      <span class="metric-pill-val">${avgPS}</span>
      <span class="metric-pill-lbl">P.Score moy.</span>
    </div>
  `;
}

const BADGE_STATUS = {
  GAP: 'badge-gap', OK: 'badge-ok', RISK: 'badge-risk',
};
const BADGE_ACTION = {
  'Create': 'badge-gap',
  'Quick Win': 'badge-ok',
  'Keep & Monitor': 'badge-ok',
  'Structural Boost': 'badge-warn',
  'Full Rewrite': 'badge-warn',
  'Merge + 301': 'badge-risk',
  'De-optimize': 'badge-risk',
};
const BADGE_INTENT = {
  'Transactionnel': 'badge-gap',
  'Commercial': 'badge-info',
  'Informationnel': 'badge-warn',
  'Navigationnel': 'badge-neutral',
};

function badge(text, cls) {
  return `<span class="badge ${cls}">${text}</span>`;
}

function renderTable() {
  const data = state.filtered.slice(0, 800);
  document.getElementById('resultsTbody').innerHTML = data.map(r => `
    <tr>
      <td class="kw-cell" title="${r.keyword}">${r.keyword}</td>
      <td class="vol-cell">${r.volume.toLocaleString('fr-FR')}</td>
      <td>${badge(r.intent, BADGE_INTENT[r.intent] || 'badge-neutral')}</td>
      <td>${badge(r.status, BADGE_STATUS[r.status] || 'badge-neutral')}</td>
      <td>${badge(r.action, BADGE_ACTION[r.action] || 'badge-neutral')}</td>
      <td class="pos-cell">${r.position != null ? r.position : '—'}</td>
      <td class="score-cell">${r.priorityScore}</td>
      <td class="score-cell" style="color:var(--accent-dim)">${r.opportunityScore.toLocaleString('fr-FR')}</td>
      <td class="title-cell" title="${r.cluster}">${r.cluster || '—'}</td>
    </tr>
  `).join('');

  // Sort indicators
  ['keyword', 'volume', 'position', 'priorityScore', 'opportunityScore'].forEach(col => {
    const th = document.getElementById(`th-${col}`);
    if (th) {
      th.classList.toggle('sort-active', state.sortCol === col);
      th.textContent = th.textContent.replace(/ [↑↓]/, '');
      if (state.sortCol === col) th.textContent += state.sortDir === 'asc' ? ' ↑' : ' ↓';
    }
  });

  const total = state.filtered.length;
  document.getElementById('rowCount').textContent =
    `${total.toLocaleString('fr-FR')} lignes${total > 800 ? ' (800 affichées, export CSV = tout)' : ''}`;
}

window.sortBy = function(col) {
  if (state.sortCol === col) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  else { state.sortCol = col; state.sortDir = 'desc'; }
  state.filtered.sort((a, b) => {
    const va = a[col] ?? (typeof a[col] === 'number' ? 0 : '');
    const vb = b[col] ?? (typeof b[col] === 'number' ? 0 : '');
    const dir = state.sortDir === 'asc' ? 1 : -1;
    return va > vb ? dir : va < vb ? -dir : 0;
  });
  renderTable();
};

window.applyFilters = function() {
  const { status, action, intent } = state.filters;
  const fStatus = document.getElementById('fStatus').value;
  const fAction = document.getElementById('fAction').value;
  const fIntent = document.getElementById('fIntent').value;
  const fSearch = document.getElementById('fSearch').value.toLowerCase().trim();

  state.filtered = state.results.filter(r => {
    if (fStatus && r.status !== fStatus) return false;
    if (fAction && !r.action.startsWith(fAction)) return false;
    if (fIntent && r.intent !== fIntent) return false;
    if (fSearch && !r.keyword.includes(fSearch) && !r.title.toLowerCase().includes(fSearch) && !r.cluster.toLowerCase().includes(fSearch)) return false;
    return true;
  });
  renderTable();
};

window.exportResults = function() {
  if (!state.results.length) { alert('Aucun résultat à exporter.'); return; }
  exportToCSV(state.results);
};
