import { useState, useRef, useCallback } from 'react'
import { SectionTitle, Btn, Divider, EmptyState } from './UI.jsx'
import styles from './Step4.module.css'

const INTENTIONS = ['Informationnelle', 'Navigationnelle', 'Transactionnelle', 'Commerciale']
const INTENTION_COLORS = {
  'Informationnelle': 'blue',
  'Navigationnelle': 'amber',
  'Transactionnelle': 'green',
  'Commerciale': 'accent',
}

function detectIntention(kw) {
  const k = kw.toLowerCase()
  if (/^(acheter|commander|prix|pas cher|promo|livraison|solde|offre|devis)/.test(k) ||
      /(acheter|commander|prix|shop|store|boutique|vente)/.test(k)) return 'Transactionnelle'
  if (/(meilleur|comparatif|avis|test|vs|ou|choisir|guide|top|classement)/.test(k)) return 'Commerciale'
  if (/(comment|pourquoi|qu est|definition|signification|kesako|c est quoi)/.test(k)) return 'Informationnelle'
  return 'Commerciale'
}

function detectCluster(kw, angles) {
  for (const angle of angles) {
    const terms = angle.terms.split('\n').map(t => t.trim().toLowerCase()).filter(Boolean)
    if (terms.some(t => kw.toLowerCase().includes(t))) return angle.name
  }
  return 'Autre'
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return null
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase())

  const kwIdx = headers.findIndex(h => ['mot-clé', 'mot-cle', 'keyword', 'kw', 'mot clé'].includes(h))
  const volIdx = headers.findIndex(h => ['volume', 'vol', 'volume mensuel', 'avg. monthly searches'].includes(h))
  const trendIdx = headers.findIndex(h => ['tendance', 'trend', 'yoy', 'variation'].includes(h))

  // Try to find monthly columns (jan, feb... or jan., fev....)
  const monthPatterns = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec',
                          'jan.', 'feb', 'apr', 'jun.', 'jul.', 'aug', 'sep.', 'oct.', 'nov.', 'dec.']
  const monthCols = headers.reduce((acc, h, i) => {
    if (monthPatterns.some(m => h.startsWith(m))) acc.push(i)
    return acc
  }, [])

  if (kwIdx === -1) return null

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.replace(/"/g, '').trim())
    if (!cols[kwIdx]) continue
    const monthly = monthCols.length >= 6 ? monthCols.map(ci => parseInt(cols[ci]) || 0) : null
    rows.push({
      kw: cols[kwIdx],
      volume: volIdx >= 0 ? (parseInt(cols[volIdx]) || 0) : 0,
      trend: trendIdx >= 0 ? (parseFloat(cols[trendIdx]) || null) : null,
      monthly,
    })
  }
  return rows
}

function MiniSparkline({ data, color = '#c8f135' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const w = 80, h = 24, pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - (v / max) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function DonutChart({ data, size = 80 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const r = 28, cx = size / 2, cy = size / 2, stroke = 10
  let offset = 0
  const circ = 2 * Math.PI * r
  const segments = data.map(d => {
    const pct = d.value / total
    const seg = { ...d, pct, offset: offset * circ, dash: pct * circ }
    offset += pct
    return seg
  })
  const COLORS = { green: '#c8f135', blue: '#378ADD', amber: '#EF9F27', accent: '#c8f135', gray: '#444' }
  return (
    <svg width={size} height={size}>
      {segments.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none"
          stroke={COLORS[s.color] || '#444'}
          strokeWidth={stroke}
          strokeDasharray={`${s.dash} ${circ - s.dash}`}
          strokeDashoffset={circ / 4 - s.offset}
          style={{ transition: 'all 0.3s' }}
        />
      ))}
      <circle cx={cx} cy={cy} r={r - stroke / 2 - 1} fill="var(--bg-secondary)" />
    </svg>
  )
}

export default function Step4({ generique, keywords: initialKw, angles }) {
  const [data, setData] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [sortCol, setSortCol] = useState('volume')
  const [sortDir, setSortDir] = useState('desc')
  const fileRef = useRef()

  function processFile(file) {
    const reader = new FileReader()
    reader.onload = e => {
      const rows = parseCSV(e.target.result)
      if (!rows || rows.length === 0) {
        setError('Format non reconnu. Vérifiez les colonnes : mot-clé, volume (et optionnel : tendance, mois).')
        return
      }
      setError('')
      const enriched = rows.map(r => ({
        ...r,
        intention: detectIntention(r.kw),
        cluster: detectCluster(r.kw, angles),
      }))
      setData(enriched)
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [angles])

  const onDragOver = e => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  // Stats
  const totalVol = data ? data.reduce((s, r) => s + r.volume, 0) : 0
  const avgVol = data ? Math.round(totalVol / data.length) : 0
  const withTrend = data ? data.filter(r => r.trend !== null) : []
  const avgTrend = withTrend.length > 0
    ? Math.round(withTrend.reduce((s, r) => s + r.trend, 0) / withTrend.length)
    : null
  const sorted = data ? [...data].sort((a, b) => {
    const av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0
    return sortDir === 'desc' ? bv - av : av - bv
  }) : []

  // Clusters
  const clusters = data ? Object.entries(
    data.reduce((acc, r) => {
      acc[r.cluster] = (acc[r.cluster] || 0) + r.volume
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]) : []

  // Intentions
  const intentionData = data ? INTENTIONS.map(i => ({
    label: i,
    color: INTENTION_COLORS[i],
    count: data.filter(r => r.intention === i).length,
    volume: data.filter(r => r.intention === i).reduce((s, r) => s + r.volume, 0),
  })).filter(i => i.count > 0) : []

  // Seasonality: average monthly volumes
  const hasMonthly = data && data.some(r => r.monthly && r.monthly.length >= 6)
  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const monthlyAvg = hasMonthly ? MONTHS.map((_, mi) => {
    const vals = data.filter(r => r.monthly && r.monthly[mi] !== undefined).map(r => r.monthly[mi])
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0)) : 0
  }) : null
  const monthlyMax = monthlyAvg ? Math.max(...monthlyAvg, 1) : 1

  // Cumulative coverage
  let cumul = 0
  const sortedByVol = data ? [...data].sort((a, b) => b.volume - a.volume) : []

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  if (!data) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <div className={styles.pageEyebrow}>Étape 5 — Dashboard</div>
          <h2 className={styles.pageTitle}>Import des <span className={styles.accentText}>volumes & tendances</span></h2>
        </div>

        <div className={styles.instructions}>
          <div className={styles.instrTitle}>Comment préparer votre fichier Google Keyword Planner</div>
          <div className={styles.instrSteps}>
            <div className={styles.instrStep}><span className={styles.instrNum}>1</span>Exportez votre liste depuis Google Keyword Planner ou Ahrefs</div>
            <div className={styles.instrStep}><span className={styles.instrNum}>2</span>Assurez-vous d'avoir les colonnes : <code>mot-clé</code>, <code>volume</code></div>
            <div className={styles.instrStep}><span className={styles.instrNum}>3</span>Optionnel : <code>tendance</code> (YOY en %), colonnes mensuelles pour la saisonnalité</div>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div
          className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current.click()}
        >
          <div className={styles.dropIcon}>↑</div>
          <div className={styles.dropTitle}>Glisser le CSV ou cliquer pour importer</div>
          <div className={styles.dropSub}>.csv · séparateurs , ; ou tab</div>
          <div className={styles.dropTags}>
            <span className={styles.dropTag}>A — Mot-clé</span>
            <span className={styles.dropTag}>B — Volume</span>
            <span className={styles.dropTag}>C — Tendance</span>
            <span className={styles.dropTag}>D — Mois…</span>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageEyebrow}>Étape 5 — Dashboard</div>
          <h2 className={styles.pageTitle}><span className={styles.accentText}>{generique}</span> — {data.length} mots-clés</h2>
        </div>
        <Btn size="sm" onClick={() => setData(null)}>↺ Réimporter</Btn>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Volume total</div>
          <div className={styles.kpiVal}>{totalVol.toLocaleString('fr-FR')}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Mots-clés</div>
          <div className={styles.kpiVal}>{data.length}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Volume moyen</div>
          <div className={styles.kpiVal}>{avgVol.toLocaleString('fr-FR')}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Tendance moy.</div>
          <div className={`${styles.kpiVal} ${avgTrend !== null ? (avgTrend >= 0 ? styles.kpiPos : styles.kpiNeg) : ''}`}>
            {avgTrend !== null ? `${avgTrend > 0 ? '+' : ''}${avgTrend}%` : '—'}
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Clusters</div>
          <div className={styles.kpiVal}>{clusters.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {['overview', 'clusters', 'intentions', 'saisonnalite', 'liste'].map(t => (
          <button key={t} className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t)}>
            {{ overview: 'Vue d\'ensemble', clusters: 'Clusters', intentions: 'Intentions', saisonnalite: 'Saisonnalité', liste: 'Liste complète' }[t]}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className={styles.overviewGrid}>
          {/* Coverage curve */}
          <div className={styles.overviewCard}>
            <div className={styles.cardTitle}>Couverture cumulée</div>
            <div className={styles.coverageChart}>
              {sortedByVol.map((r, i) => {
                cumul += r.volume
                const pct = totalVol > 0 ? (cumul / totalVol) * 100 : 0
                const isLast = i === sortedByVol.length - 1
                return null // we'll draw bars below
              })}
              <div className={styles.barChart}>
                {sortedByVol.slice(0, 20).map((r, i) => {
                  const pct = totalVol > 0 ? (r.volume / sortedByVol[0].volume) * 100 : 0
                  return (
                    <div key={i} className={styles.barRow}>
                      <div className={styles.barLabel}>{r.kw}</div>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={styles.barVal}>{r.volume.toLocaleString('fr-FR')}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Cluster donut */}
          <div className={styles.overviewCard}>
            <div className={styles.cardTitle}>Répartition par cluster</div>
            <div className={styles.donutWrap}>
              <DonutChart size={100}
                data={clusters.slice(0, 6).map((c, i) => ({
                  value: c[1],
                  color: ['green', 'blue', 'amber', 'accent', 'gray', 'gray'][i],
                }))}
              />
            </div>
            <div className={styles.clusterList}>
              {clusters.map(([name, vol], i) => (
                <div key={name} className={styles.clusterItem}>
                  <span className={`${styles.clusterDot} ${styles[`dot${i % 4}`]}`}></span>
                  <span className={styles.clusterName}>{name}</span>
                  <span className={styles.clusterVol}>{vol.toLocaleString('fr-FR')}</span>
                  <span className={styles.clusterPct}>{totalVol > 0 ? Math.round((vol / totalVol) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clusters tab */}
      {activeTab === 'clusters' && (
        <div>
          {clusters.map(([clusterName, clusterVol]) => {
            const items = sorted.filter(r => r.cluster === clusterName)
            return (
              <div key={clusterName} className={styles.clusterBlock}>
                <div className={styles.clusterBlockHeader}>
                  <span className={styles.clusterBlockName}>{clusterName}</span>
                  <span className={styles.clusterBlockStats}>{items.length} mots-clés · {clusterVol.toLocaleString('fr-FR')} vol</span>
                </div>
                <div className={styles.clusterTable}>
                  {items.slice(0, 10).map(r => (
                    <div key={r.kw} className={styles.clusterRow}>
                      <span className={styles.clusterKw}>{r.kw}</span>
                      <span className={`${styles.intentionTag} ${styles[`intent${r.intention.charAt(0)}`]}`}>{r.intention}</span>
                      <span className={styles.clusterVol}>{r.volume.toLocaleString('fr-FR')}</span>
                      {r.trend !== null && (
                        <span className={`${styles.trendBadge} ${r.trend >= 0 ? styles.trendPos : styles.trendNeg}`}>
                          {r.trend > 0 ? '+' : ''}{r.trend}%
                        </span>
                      )}
                    </div>
                  ))}
                  {items.length > 10 && <div className={styles.moreRows}>+{items.length - 10} autres</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Intentions tab */}
      {activeTab === 'intentions' && (
        <div>
          <div className={styles.intentionsGrid}>
            {intentionData.map(intent => (
              <div key={intent.label} className={styles.intentCard}>
                <div className={`${styles.intentBadge} ${styles[`intent${intent.label.charAt(0)}`]}`}>{intent.label}</div>
                <div className={styles.intentVal}>{intent.count}</div>
                <div className={styles.intentSub}>{intent.volume.toLocaleString('fr-FR')} vol · {totalVol > 0 ? Math.round((intent.volume / totalVol) * 100) : 0}%</div>
                <div className={styles.intentBar}>
                  <div className={styles.intentBarFill} style={{ width: `${totalVol > 0 ? (intent.volume / totalVol) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Divider />
          <SectionTitle>Détail par intention</SectionTitle>
          {INTENTIONS.map(intent => {
            const items = sorted.filter(r => r.intention === intent)
            if (items.length === 0) return null
            return (
              <div key={intent} className={styles.intentSection}>
                <div className={`${styles.intentSectionBadge} ${styles[`intent${intent.charAt(0)}`]}`}>{intent}</div>
                <div className={styles.clusterTable}>
                  {items.slice(0, 8).map(r => (
                    <div key={r.kw} className={styles.clusterRow}>
                      <span className={styles.clusterKw}>{r.kw}</span>
                      <span className={styles.clusterName} style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{r.cluster}</span>
                      <span className={styles.clusterVol}>{r.volume.toLocaleString('fr-FR')}</span>
                    </div>
                  ))}
                  {items.length > 8 && <div className={styles.moreRows}>+{items.length - 8} autres</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Seasonality tab */}
      {activeTab === 'saisonnalite' && (
        <div>
          {!hasMonthly ? (
            <div className={styles.noSeasonality}>
              <div className={styles.noSeasonalityIcon}>~</div>
              <div>Pas de données mensuelles dans votre CSV.</div>
              <div className={styles.noSeasonalitySub}>Exportez depuis Google Keyword Planner en incluant les données mensuelles pour visualiser la saisonnalité.</div>
            </div>
          ) : (
            <div>
              <div className={styles.seasonCard}>
                <div className={styles.cardTitle}>Volume mensuel agrégé</div>
                <div className={styles.seasonBars}>
                  {monthlyAvg.map((val, i) => (
                    <div key={i} className={styles.seasonCol}>
                      <div className={styles.seasonBarWrap}>
                        <div className={styles.seasonBar} style={{ height: `${(val / monthlyMax) * 100}%` }} />
                      </div>
                      <div className={styles.seasonMonth}>{MONTHS[i]}</div>
                      <div className={styles.seasonVal}>{(val / 1000).toFixed(0)}k</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.topSeasonCard}>
                <div className={styles.cardTitle}>Top mois</div>
                <div className={styles.topMonths}>
                  {[...monthlyAvg.map((v, i) => ({ v, i }))].sort((a, b) => b.v - a.v).slice(0, 3).map(({ v, i }) => (
                    <div key={i} className={styles.topMonth}>
                      <span className={styles.topMonthName}>{MONTHS[i]}</span>
                      <span className={styles.topMonthVal}>{v.toLocaleString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full list */}
      {activeTab === 'liste' && (
        <div>
          <div className={styles.listHeader}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {data.length} mots-clés · {totalVol.toLocaleString('fr-FR')} vol total
            </span>
          </div>
          <div className={styles.listTable}>
            <div className={styles.listHeadRow}>
              <span className={styles.listHeadKw}>Mot-clé</span>
              <span className={styles.listHeadCluster}>Cluster</span>
              <span className={styles.listHeadIntent}>Intention</span>
              <span className={`${styles.listHeadNum} ${sortCol === 'volume' ? styles.sortActive : ''}`}
                onClick={() => toggleSort('volume')} style={{ cursor: 'pointer' }}>
                Volume {sortCol === 'volume' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
              </span>
              <span className={`${styles.listHeadNum} ${sortCol === 'trend' ? styles.sortActive : ''}`}
                onClick={() => toggleSort('trend')} style={{ cursor: 'pointer' }}>
                Tendance {sortCol === 'trend' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
              </span>
              {hasMonthly && <span className={styles.listHeadNum}>Saisonnalité</span>}
            </div>
            {sorted.map(r => (
              <div key={r.kw} className={styles.listRow}>
                <span className={styles.listKw}>{r.kw}</span>
                <span className={styles.listCluster}>{r.cluster}</span>
                <span className={`${styles.intentionTag} ${styles[`intent${r.intention.charAt(0)}`]}`}>{r.intention.slice(0, 4)}.</span>
                <span className={styles.listNum}>{r.volume.toLocaleString('fr-FR')}</span>
                <span className={`${styles.listNum} ${r.trend !== null ? (r.trend >= 0 ? styles.kpiPos : styles.kpiNeg) : ''}`}>
                  {r.trend !== null ? `${r.trend > 0 ? '+' : ''}${r.trend}%` : '—'}
                </span>
                {hasMonthly && <span className={styles.listSpark}><MiniSparkline data={r.monthly} /></span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
