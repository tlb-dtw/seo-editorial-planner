import { parseCSV, deduplicateKeywords } from './lib/csvParser.js';
import { buildAhrefsIndex } from './lib/scoring.js';
import { categorizeBatch, createFallbackBatch, sleep } from './lib/anthropicClient.js';
import { enrichKeywordsWithSemrush } from './lib/semrushClient.js';
import { clusterIntoPages } from './lib/pageClustering.js';
import { exportPagesToCSV } from './lib/exportCSV.js';

// ── STATE ────────────────────────────────────────────────────
const state = {
  step: 1,
  kpData: [], ahrefsData: [],
  pages: [], filtered: [],
  sortCol: 'trafficIncremental', sortDir: 'desc',
  abortController: null,
  filters: { action: '', intent: '', search: '' },
};

document.getElementById('app').innerHTML = buildHTML();
bindEvents();
setStep(1);

// ── HTML ─────────────────────────────────────────────────────
function buildHTML() {
  return `
  <header class="app-header">
    <div class="header-brand">
      <h1>SEO Editorial Planner</h1>
      <span class="version-tag">V1</span>
    </div>
    <nav class="header-nav">
      ${['Import','Config','Analyse','Résultats'].map((l,i) => `
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
          <p class="step1-desc">Importez vos exports Keyword Planner et Ahrefs. L'outil regroupe les keywords en pages, catégorise par intention et format SERP via SEMrush, et génère un planning priorisé par trafic incrémental — une ligne par page.</p>
          <div class="stat-row">
            <div class="stat-item"><span class="stat-num">1</span><span class="stat-label">ligne = 1 page</span></div>
            <div class="stat-item"><span class="stat-num">15</span><span class="stat-label">colonnes output</span></div>
            <div class="stat-item"><span class="stat-num">&lt;10€</span><span class="stat-label">par analyse</span></div>
          </div>
        </div>
        <div class="step1-right">
          ${uploadCard(1,'Keywords + Volumes','Google Keyword Planner',[{l:'A — Mot-clé',r:true},{l:'B — Volume',r:true}])}
          ${uploadCard(2,'Positions Ahrefs','Ahrefs Keywords Explorer',[{l:'A — Mot-clé',r:true},{l:'B — Volume',r:true},{l:'C — Position',r:true},{l:'D — URL',r:false}])}
        </div>
      </div>
      <div class="step1-footer">
        <div class="loaded-summary" id="loadedSummary">Importez les deux fichiers pour continuer</div>
        <button class="btn btn-primary" id="btnStep2" disabled onclick="goStep(2)">Configurer →</button>
      </div>
    </div>

    <!-- STEP 2 -->
    <div class="section" id="sec2">
      <div class="step2-layout">
        <h2 class="config-title">Configuration</h2>
        <p class="config-sub">Les clés API ne sont jamais stockées — utilisées uniquement en mémoire navigateur.</p>

        <div class="config-section">
          <div class="config-section-header"><span class="config-section-label">Anthropic API</span></div>
          <div class="config-section-body">
            <div class="field">
              <label>Clé API Anthropic</label>
              <div class="key-row">
                <input type="password" id="apikey" placeholder="sk-ant-api03-..." autocomplete="off">
                <button class="btn btn-sm" onclick="toggleVis('apikey')">Afficher</button>
              </div>
              <span class="field-hint">Catégorisation keywords — <a href="https://console.anthropic.com" target="_blank" style="color:var(--accent)">console.anthropic.com</a></span>
            </div>
          </div>
        </div>

        <div class="config-section">
          <div class="config-section-header"><span class="config-section-label">SEMrush API</span></div>
          <div class="config-section-body">
            <div class="field">
              <label>Clé API SEMrush</label>
              <div class="key-row">
                <input type="password" id="semrushkey" placeholder="Votre clé SEMrush..." autocomplete="off">
                <button class="btn btn-sm" onclick="toggleVis('semrushkey')">Afficher</button>
              </div>
              <span class="field-hint">Intention & format SERP réels — <a href="https://www.semrush.com/api-analytics/" target="_blank" style="color:var(--accent)">semrush.com/api-analytics</a></span>
            </div>
            <div class="field">
              <label>Base de données SEMrush</label>
              <select id="semrushDb">
                <option value="us">us — United States</option>
                <option value="uk">uk — United Kingdom</option>
                <option value="fr">fr — France</option>
                <option value="de">de — Germany</option>
                <option value="es">es — Spain</option>
                <option value="it">it — Italy</option>
                <option value="ca">ca — Canada</option>
                <option value="au">au — Australia</option>
              </select>
              <span class="field-hint">Laisser vide pour désactiver SEMrush — l'intention sera estimée par Claude</span>
            </div>
          </div>
        </div>

        <div class="config-section">
          <div class="config-section-header"><span class="config-section-label">Paramètres</span></div>
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
                <label>Taille des lots Claude</label>
                <select id="batchSize">
                  <option value="25">25 — prudent</option>
                  <option value="40" selected>40 — recommandé</option>
                  <option value="60">60 — rapide</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="config-footer">
          <button class="btn btn-ghost" onclick="goStep(1)">← Retour</button>
          <button class="btn btn-primary" onclick="goStep(3)">Lancer l'analyse →</button>
        </div>
      </div>
    </div>

    <!-- STEP 3 -->
    <div class="section" id="sec3">
      <div class="step3-layout">
        <div class="analysis-header">
          <div class="analysis-label">En cours</div>
          <h2 class="analysis-title">Analyse en cours</h2>
        </div>
        <div class="progress-status">
          <span id="progressMsg">Initialisation...</span>
          <span class="progress-pct" id="progressPct">0%</span>
        </div>
        <div class="progress-track"><div class="progress-bar" id="progressBar" style="width:0%"></div></div>
        <div class="log-console" id="logConsole"></div>
        <div class="abort-row"><button class="btn btn-sm" onclick="abortAnalysis()">Annuler</button></div>
      </div>
    </div>

    <!-- STEP 4 -->
    <div class="section" id="sec4">
      <div class="step4-layout">
        <div class="results-toolbar">
          <div class="metrics-strip" id="metricsStrip"></div>
          <div class="filter-group">
            <select class="filter-select" id="fAction" onchange="applyFilters()">
              <option value="">Toutes actions</option>
              <option>Create</option><option>Quick Win</option>
              <option>Keep & Monitor</option><option>Structural Boost</option>
              <option>Full Rewrite</option><option>Merge + 301</option>
            </select>
            <select class="filter-select" id="fIntent" onchange="applyFilters()">
              <option value="">Toutes intentions</option>
              <option>Transactionnel</option><option>Commercial</option>
              <option>Informationnel</option><option>Navigationnel</option>
            </select>
            <input type="text" class="search-input" id="fSearch" placeholder="Rechercher..." oninput="applyFilters()">
          </div>
          <div class="toolbar-right">
            <button class="btn btn-sm" onclick="exportResults()">Export CSV</button>
            <button class="btn btn-sm btn-ghost" onclick="goStep(1)">Nouvelle analyse</button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <colgroup>
              <col style="width:12%"><col style="width:18%"><col style="width:10%">
              <col style="width:14%"><col style="width:7%"><col style="width:6%">
              <col style="width:5%"><col style="width:8%"><col style="width:8%">
              <col style="width:7%"><col style="width:5%">
            </colgroup>
            <thead><tr>
              <th class="sortable" onclick="sortBy('action')" id="th-action">Action</th>
              <th>URL / Cluster</th>
              <th class="sortable" onclick="sortBy('mainKeyword')" id="th-mainKeyword">KW principal</th>
              <th>KW secondaires</th>
              <th class="sortable" onclick="sortBy('mainVolume')" id="th-mainVolume">Vol.</th>
              <th class="sortable" onclick="sortBy('mainPosition')" id="th-mainPosition">Pos.</th>
              <th class="sortable" onclick="sortBy('kwPositionnedCount')" id="th-kwPositionnedCount">KW pos.</th>
              <th class="sortable" onclick="sortBy('trafficCurrent')" id="th-trafficCurrent">Trafic actuel</th>
              <th class="sortable" onclick="sortBy('trafficIncremental')" id="th-trafficIncremental">Gain pos.1 ↑</th>
              <th>Intention</th>
              <th>Format</th>
            </tr></thead>
            <tbody id="resultsTbody"></tbody>
          </table>
        </div>
        <div class="table-footer">
          <span id="rowCount">—</span>
          <span style="color:var(--text-3)">Trié par trafic incrémental — Export CSV = toutes les colonnes + titres</span>
        </div>
      </div>
    </div>

  </main>`;
}

function uploadCard(num, title, sub, cols) {
  const schema = cols.map(c => `<span class="schema-col ${c.r?'required':''}">${c.l}</span>`).join('');
  return `
  <div class="upload-card">
    <div class="upload-card-header">
      <div class="upload-card-num">${num}</div>
      <div><div class="upload-card-title">${title}</div></div>
      <div class="upload-card-sub">${sub}</div>
    </div>
    <div class="upload-schema">${schema}</div>
    <div class="drop-zone" id="drop${num}" onclick="document.getElementById('file${num}').click()">
      <div class="drop-zone-icon">↑</div>
      <div class="drop-zone-label" id="dz${num}label">Cliquer ou glisser le CSV</div>
      <div class="drop-zone-meta" id="dz${num}meta">.csv · séparateurs , ; ou tab</div>
    </div>
    <input type="file" id="file${num}" accept=".csv,.txt" style="display:none">
    <div class="file-preview" id="prev${num}"></div>
    <div class="upload-error" id="err${num}"></div>
  </div>`;
}

// ── EVENTS ───────────────────────────────────────────────────
function bindEvents() {
  setupUpload(1); setupUpload(2);
}

function setupUpload(num) {
  const inp = document.getElementById(`file${num}`);
  const dz = document.getElementById(`drop${num}`);
  const handle = f => {
    if (!f) return;
    document.getElementById(`err${num}`).classList.remove('show');
    const r = new FileReader();
    r.onload = e => processFile(e.target.result, num, f.name);
    r.onerror = () => showErr(num, 'Impossible de lire le fichier');
    r.readAsText(f, 'UTF-8');
  };
  inp.addEventListener('change', () => handle(inp.files[0]));
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor='var(--accent-dim)'; });
  dz.addEventListener('dragleave', () => { dz.style.borderColor=''; });
  dz.addEventListener('drop', e => { e.preventDefault(); dz.style.borderColor=''; handle(e.dataTransfer.files[0]); });
}

function processFile(text, num, filename) {
  try {
    const ft = num === 1 ? 'kp' : 'ahrefs';
    const { rows } = parseCSV(text, ft);
    if (!rows.length) throw new Error('Aucune ligne valide');
    if (num === 1) state.kpData = rows;
    else state.ahrefsData = rows;
    document.getElementById(`drop${num}`).classList.add('loaded');
    document.getElementById(`dz${num}label`).textContent = filename;
    document.getElementById(`dz${num}meta`).textContent = `${rows.length.toLocaleString('fr-FR')} keywords`;
    const pv = document.getElementById(`prev${num}`);
    pv.classList.add('show');
    pv.textContent = 'Aperçu — ' + rows.slice(0,3).map(r=>r.slice(0,4).join(' | ')).join(' · ');
    checkReady();
  } catch(e) { showErr(num, e.message); }
}

function showErr(num, msg) {
  const el = document.getElementById(`err${num}`);
  el.textContent = '✗ ' + msg; el.classList.add('show');
}

function checkReady() {
  const ok = state.kpData.length > 0 && state.ahrefsData.length > 0;
  document.getElementById('btnStep2').disabled = !ok;
  if (ok) {
    document.getElementById('loadedSummary').innerHTML =
      `Fichier 1 : <span>${state.kpData.length.toLocaleString('fr-FR')} kw</span> &nbsp;·&nbsp; Fichier 2 : <span>${state.ahrefsData.length.toLocaleString('fr-FR')} positions</span>`;
  }
}

// ── NAVIGATION ───────────────────────────────────────────────
function setStep(n) {
  [1,2,3,4].forEach(i => {
    document.getElementById(`sec${i}`).classList.remove('visible');
    const nav = document.getElementById(`nav-${i}`);
    nav.classList.remove('active','done');
    if (i < n) nav.classList.add('done');
  });
  document.getElementById(`sec${n}`).classList.add('visible');
  document.getElementById(`nav-${n}`).classList.add('active');
  state.step = n;
}

window.goStep = function(n) {
  if (n === 3) {
    if (!document.getElementById('apikey').value.trim()) {
      alert('Clé API Anthropic manquante.'); return;
    }
    startAnalysis();
  }
  setStep(n);
};

window.toggleVis = function(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
};

// ── ANALYSIS ─────────────────────────────────────────────────
async function startAnalysis() {
  state.abortController = new AbortController();
  const { signal } = state.abortController;
  const apiKey = document.getElementById('apikey').value.trim();
  const semrushKey = document.getElementById('semrushkey').value.trim();
  const semrushDb = document.getElementById('semrushDb').value;
  const lang = document.getElementById('lang').value;
  const BATCH = parseInt(document.getElementById('batchSize').value);

  document.getElementById('logConsole').innerHTML = '';

  const log = (msg, type='info') => {
    const el = document.getElementById('logConsole');
    el.innerHTML += `<span class="log-${type}">${msg}</span><br>`;
    el.scrollTop = el.scrollHeight;
  };
  const setProgress = (pct, msg) => {
    document.getElementById('progressBar').style.width = Math.min(pct,100)+'%';
    document.getElementById('progressMsg').textContent = msg;
    document.getElementById('progressPct').textContent = Math.round(pct)+'%';
  };

  try {
    // ── 1. Nettoyage ──────────────────────────────────────────
    log(`▶ Démarrage — ${state.kpData.length} kw source · ${state.ahrefsData.length} positions Ahrefs`, 'accent');
    setProgress(5, 'Nettoyage des données...');
    const cleaned = deduplicateKeywords(state.kpData);
    log(`Nettoyage : ${state.kpData.length} → ${cleaned.length} keywords`);
    const ahrefsMap = buildAhrefsIndex(state.ahrefsData);
    log(`Index Ahrefs : ${Object.keys(ahrefsMap).length} entrées`);

    // ── 2. Catégorisation Claude Haiku ────────────────────────
    const batches = [];
    for (let i = 0; i < cleaned.length; i += BATCH) batches.push(cleaned.slice(i, i+BATCH));
    log(`${batches.length} lots de ~${BATCH} keywords → Claude Haiku`);
    setProgress(10, 'Catégorisation Claude...');

    let categorized = [];
    for (let b = 0; b < batches.length; b++) {
      if (signal.aborted) { log('⚠ Annulé','err'); break; }
      setProgress(10 + (b/batches.length)*45, `Lot ${b+1}/${batches.length}...`);
      log(`→ Lot ${b+1}/${batches.length} · ${batches[b].length} kw`);
      try {
        const res = await categorizeBatch(batches[b], lang, apiKey, signal);
        categorized = categorized.concat(res);
        log(`  ✓ ${res.length} catégorisés`, 'ok');
      } catch(e) {
        if (e.name === 'AbortError') break;
        log(`  ✗ ${e.message.substring(0,100)}`, 'err');
        categorized = categorized.concat(createFallbackBatch(batches[b]));
        log(`  → Fallback appliqué`, 'info');
      }
      if (b < batches.length-1) await sleep(350);
    }

    // ── 3. Clustering en pages ────────────────────────────────
    setProgress(58, 'Clustering keywords → pages...');
    log('Regroupement par URL Ahrefs + clustering sémantique GAP...', 'accent');
    let pages = clusterIntoPages(categorized, ahrefsMap);
    log(`✓ ${pages.length} pages identifiées`, 'ok');

    // ── 4. Enrichissement SEMrush (optionnel) ─────────────────
    if (semrushKey) {
      const mainKws = pages.map(p => p.mainKeyword).filter(Boolean);
      log(`SEMrush : enrichissement de ${mainKws.length} keywords principaux...`, 'accent');
      setProgress(62, 'SEMrush — intention & format SERP réels...');

      try {
        const semrushData = await enrichKeywordsWithSemrush(
          mainKws, semrushDb, semrushKey, signal,
          msg => { log(`  ${msg}`); }
        );

        let enriched = 0;
        pages.forEach(p => {
          const d = semrushData.get(p.mainKeyword);
          if (d) {
            if (d.intent) p.intent = d.intent;
            if (d.serpFormat) p.serpFormat = d.serpFormat;
            enriched++;
          }
        });
        log(`✓ ${enriched} pages enrichies via SEMrush`, 'ok');
      } catch(e) {
        log(`⚠ SEMrush : ${e.message} — on continue avec les données Claude`, 'err');
      }
    } else {
      log('SEMrush désactivé — intention estimée par Claude', 'info');
    }

    // ── 5. Finalisation ───────────────────────────────────────
    setProgress(95, 'Finalisation...');
    state.pages = pages;
    state.filtered = [...pages];

    const gap = pages.filter(p => p.status === 'GAP').length;
    const ok = pages.filter(p => p.status === 'OK').length;
    const risk = pages.filter(p => p.status === 'RISK').length;
    const totalIncr = pages.reduce((a,p) => a + p.trafficIncremental, 0);

    setProgress(100, 'Terminé');
    log('');
    log(`✓ ${pages.length} pages · GAP:${gap} OK:${ok} RISK:${risk}`, 'ok');
    log(`Gain trafic potentiel total : +${totalIncr.toLocaleString('fr-FR')} visites/mois`, 'accent');

    setTimeout(() => {
      ['s1','s2','s3'].forEach(id => document.getElementById(id).classList.add('done'));
      setStep(4);
      renderMetrics();
      renderTable();
    }, 600);

  } catch(e) {
    if (e.name !== 'AbortError') log(`Erreur fatale : ${e.message}`, 'err');
  }
}

window.abortAnalysis = () => state.abortController?.abort();

// ── RENDER ───────────────────────────────────────────────────
function renderMetrics() {
  const p = state.pages;
  const gap = p.filter(x => x.status==='GAP').length;
  const ok = p.filter(x => x.status==='OK').length;
  const risk = p.filter(x => x.status==='RISK').length;
  const totalIncr = p.reduce((a,x) => a+x.trafficIncremental, 0);
  const fmt = n => n >= 1000 ? (Math.round(n/100)/10)+'k' : n.toString();

  document.getElementById('metricsStrip').innerHTML = `
    <div class="metric-pill m-total"><span class="metric-pill-val">${p.length}</span><span class="metric-pill-lbl">Pages</span></div>
    <div class="metric-pill m-gap"><span class="metric-pill-val">${gap}</span><span class="metric-pill-lbl">GAP</span></div>
    <div class="metric-pill m-ok"><span class="metric-pill-val">${ok}</span><span class="metric-pill-lbl">OK</span></div>
    <div class="metric-pill m-risk"><span class="metric-pill-val">${risk}</span><span class="metric-pill-lbl">RISK</span></div>
    <div class="metric-pill m-score" title="Gain trafic total si toutes les pages passent en position 1">
      <span class="metric-pill-val">+${fmt(totalIncr)}</span>
      <span class="metric-pill-lbl">Gain pot. total</span>
    </div>`;
}

const BA = { 'Create':'badge-gap','Quick Win':'badge-ok','Keep & Monitor':'badge-ok','Structural Boost':'badge-warn','Full Rewrite':'badge-warn','Merge + 301':'badge-risk','De-optimize':'badge-risk' };
const BI = { 'Transactionnel':'badge-gap','Commercial':'badge-info','Informationnel':'badge-warn','Navigationnel':'badge-neutral' };
const b = (t,c) => `<span class="badge ${c}">${t}</span>`;

function renderTable() {
  const data = state.filtered.slice(0, 800);
  document.getElementById('resultsTbody').innerHTML = data.map(p => {
    const urlDisplay = p.url
      ? `<span style="font-size:10px;color:var(--text-3)" title="${p.url}">${p.url.replace(/https?:\/\/[^/]+/,'').substring(0,35)||p.url.substring(0,35)}…</span>`
      : `<span style="font-size:11px;color:var(--accent-dim)">${p.cluster||'—'}</span>`;
    const secKws = p.secondaryKeywords.slice(0,3).join(', ') + (p.secondaryKeywords.length > 3 ? ` +${p.secondaryKeywords.length-3}` : '');
    return `<tr>
      <td>${b(p.action, BA[p.action]||'badge-neutral')}</td>
      <td title="${p.url||p.cluster}">${urlDisplay}</td>
      <td style="font-weight:500;color:var(--text)" title="${p.mainKeyword}">${p.mainKeyword||'—'}</td>
      <td style="font-size:11px;color:var(--text-3)" title="${p.secondaryKeywords.join(', ')}">${secKws||'—'}</td>
      <td style="color:var(--text);font-weight:500">${(p.mainVolume||0).toLocaleString('fr-FR')}</td>
      <td style="color:var(--text-3)">${p.mainPosition!=null?p.mainPosition:'—'}</td>
      <td style="color:var(--text-2)">${p.kwPositionnedCount||0}</td>
      <td style="color:var(--text-3)">${(p.trafficCurrent||0).toLocaleString('fr-FR')}</td>
      <td style="color:var(--accent-dim);font-weight:600">+${(p.trafficIncremental||0).toLocaleString('fr-FR')}</td>
      <td>${p.intent ? b(p.intent, BI[p.intent]||'badge-neutral') : '—'}</td>
      <td style="font-size:11px;color:var(--text-3)">${p.serpFormat||'—'}</td>
    </tr>`;
  }).join('');

  // Sort indicators
  ['action','mainKeyword','mainVolume','mainPosition','kwPositionnedCount','trafficCurrent','trafficIncremental'].forEach(col => {
    const th = document.getElementById(`th-${col}`);
    if (!th) return;
    th.classList.toggle('sort-active', state.sortCol === col);
    th.textContent = th.textContent.replace(/ [↑↓]/,'');
    if (state.sortCol === col) th.textContent += state.sortDir === 'asc' ? ' ↑' : ' ↓';
  });

  const total = state.filtered.length;
  document.getElementById('rowCount').textContent =
    `${total.toLocaleString('fr-FR')} pages${total > 800 ? ' (800 affichées, export CSV = tout)' : ''}`;
}

window.sortBy = function(col) {
  if (state.sortCol === col) state.sortDir = state.sortDir==='asc'?'desc':'asc';
  else { state.sortCol = col; state.sortDir = 'desc'; }
  state.filtered.sort((a,b) => {
    const va = a[col]??0, vb = b[col]??0;
    const d = state.sortDir==='asc'?1:-1;
    return va>vb?d:va<vb?-d:0;
  });
  renderTable();
};

window.applyFilters = function() {
  const fA = document.getElementById('fAction').value;
  const fI = document.getElementById('fIntent').value;
  const fS = document.getElementById('fSearch').value.toLowerCase().trim();
  state.filtered = state.pages.filter(p => {
    if (fA && !p.action.startsWith(fA)) return false;
    if (fI && p.intent !== fI) return false;
    if (fS && !p.mainKeyword?.toLowerCase().includes(fS)
            && !p.url?.toLowerCase().includes(fS)
            && !p.cluster?.toLowerCase().includes(fS)) return false;
    return true;
  });
  renderTable();
};

window.exportResults = function() {
  if (!state.pages.length) { alert('Aucun résultat.'); return; }
  exportPagesToCSV(state.pages);
};
