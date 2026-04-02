import { useState } from 'react'
import { SectionTitle, Btn, EmptyState } from './UI.jsx'
import styles from './Bloc3.module.css'

export default function Bloc3({ generique, keywords, setKeywords }) {
  const [sortedDesc, setSortedDesc] = useState(true)

  function setVolume(kw, val) {
    setKeywords(prev => prev.map(k =>
      k.kw === kw ? { ...k, volume: val !== '' ? parseInt(val) : null } : k
    ))
  }

  function sortByVolume() {
    setKeywords(prev => {
      const sorted = [...prev].sort((a, b) => {
        const av = a.volume ?? -1
        const bv = b.volume ?? -1
        return sortedDesc ? av - bv : bv - av
      })
      setSortedDesc(d => !d)
      return sorted
    })
  }

  function exportCSV() {
    const sorted = [...keywords].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    const total = sorted.reduce((s, k) => s + (k.volume ?? 0), 0)
    let cumul = 0
    let csv = 'Mot-clé,Volume,Cumul VR,% Couverture\n'
    sorted.forEach(k => {
      cumul += k.volume ?? 0
      const pct = total > 0 ? Math.round((cumul / total) * 100) : ''
      csv += `"${k.kw}",${k.volume ?? ''},${total > 0 ? cumul : ''},${pct !== '' ? pct + '%' : ''}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${generique || 'etude-semantique'}-keywords.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalVol = keywords.reduce((s, k) => s + (k.volume ?? 0), 0)
  const withVol = keywords.filter(k => k.volume !== null).length
  let cumul = 0

  if (keywords.length === 0) {
    return (
      <EmptyState>
        Aucun mot-clé. Générez d'abord les croisements dans le Bloc 2.
      </EmptyState>
    )
  }

  return (
    <div>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Mots-clés</div>
          <div className={styles.statValue}>{keywords.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Volume total</div>
          <div className={styles.statValue}>{totalVol.toLocaleString('fr-FR')}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Renseignés</div>
          <div className={styles.statValue}>
            {keywords.length > 0 ? Math.round((withVol / keywords.length) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className={styles.tableHeader}>
        <SectionTitle>Liste priorisée</SectionTitle>
        <div className={styles.actions}>
          <Btn size="sm" onClick={sortByVolume}>
            Trier par volume {sortedDesc ? '↓' : '↑'}
          </Btn>
          <Btn size="sm" variant="primary" onClick={exportCSV}>
            Exporter CSV
          </Btn>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thKw}>Mot-clé</th>
              <th className={styles.thNum}>Volume</th>
              <th className={styles.thNum}>Cumul VR</th>
              <th className={styles.thPct}>Couverture</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map(k => {
              cumul += k.volume ?? 0
              const pct = totalVol > 0 ? Math.round((cumul / totalVol) * 100) : null
              return (
                <tr key={k.kw} className={styles.row}>
                  <td className={styles.tdKw}>{k.kw}</td>
                  <td className={styles.tdNum}>
                    <input
                      type="number"
                      className={styles.volInput}
                      placeholder="—"
                      value={k.volume !== null ? k.volume : ''}
                      min="0"
                      onChange={e => setVolume(k.kw, e.target.value)}
                    />
                  </td>
                  <td className={styles.tdNum}>
                    {totalVol > 0 ? cumul.toLocaleString('fr-FR') : <span className={styles.muted}>—</span>}
                  </td>
                  <td className={styles.tdPct}>
                    {pct !== null ? (
                      <div className={styles.pctCell}>
                        <span className={styles.pctNum}>{pct}%</span>
                        <div className={styles.bar}>
                          <div className={styles.barFill} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ) : <span className={styles.muted}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
