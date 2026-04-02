import { Card, SectionTitle, Btn, Divider, EmptyState } from './UI.jsx'
import styles from './Bloc2.module.css'

function getTerms(angle) {
  return angle.terms.split('\n').map(t => t.trim()).filter(Boolean)
}

function cartesian(arrays) {
  return arrays.reduce((acc, arr) => acc.flatMap(c => arr.map(item => [...c, item])), [[]])
}

function getCompatKey(a, b) {
  return [Math.min(a, b), Math.max(a, b)].join('-')
}

const COMPAT_CYCLE = { ok: 'rare', rare: 'no', no: 'ok' }
const COMPAT_LABELS = { ok: '✓', rare: '~', no: '✕' }

export default function Bloc2({
  generique, angles, schemas, setSchemas, compat, setCompat,
  keywords, setKeywords, nextSchemaId, setNextSchemaId
}) {
  function addSchema() {
    setSchemas(prev => [...prev, { id: nextSchemaId, slots: [0, angles[0]?.id ?? 1] }])
    setNextSchemaId(n => n + 1)
  }

  function removeSchema(id) {
    setSchemas(prev => prev.filter(s => s.id !== id))
  }

  function updateSlot(schemaId, slotIdx, val) {
    setSchemas(prev => prev.map(s => {
      if (s.id !== schemaId) return s
      const slots = [...s.slots]
      slots[slotIdx] = parseInt(val)
      return { ...s, slots }
    }))
  }

  function addSlot(schemaId) {
    setSchemas(prev => prev.map(s => {
      if (s.id !== schemaId || s.slots.length >= 4) return s
      return { ...s, slots: [...s.slots, angles[0]?.id ?? 1] }
    }))
  }

  function removeSlot(schemaId) {
    setSchemas(prev => prev.map(s => {
      if (s.id !== schemaId || s.slots.length <= 2) return s
      return { ...s, slots: s.slots.slice(0, -1) }
    }))
  }

  function cycleCompat(aId, bId) {
    const key = getCompatKey(aId, bId)
    setCompat(prev => ({ ...prev, [key]: COMPAT_CYCLE[prev[key] ?? 'ok'] }))
  }

  function getCompat(aId, bId) {
    return compat[getCompatKey(aId, bId)] ?? 'ok'
  }

  function generate() {
    const gens = generique ? [generique] : ['generique']
    const allKw = new Set()

    schemas.forEach(schema => {
      const lists = schema.slots.map(id => {
        if (id === 0) return gens
        const angle = angles.find(a => a.id === id)
        return angle ? getTerms(angle) : []
      })
      if (lists.some(l => l.length === 0)) return
      cartesian(lists).forEach(combo => {
        const kw = combo.join(' ').trim()
        if (kw) allKw.add(kw)
      })
    })

    setKeywords([...allKw].map(kw => ({ kw, volume: null })))
  }

  const angleOptions = [{ id: 0, name: 'Générique' }, ...angles]

  return (
    <div>
      <div className={styles.header}>
        <SectionTitle>Schémas de recherche</SectionTitle>
        <Btn size="sm" onClick={addSchema}>+ Schéma</Btn>
      </div>

      <Card>
        {schemas.length === 0 && <EmptyState>Aucun schéma. Ajoutez-en un.</EmptyState>}
        <div className={styles.schemasList}>
          {schemas.map(schema => (
            <div key={schema.id} className={styles.schemaRow}>
              <span className={styles.schemaNum}>#{schema.id}</span>
              <div className={styles.slots}>
                {schema.slots.map((slotId, idx) => (
                  <span key={idx} className={styles.slotGroup}>
                    {idx > 0 && <span className={styles.plus}>+</span>}
                    <select
                      value={slotId}
                      onChange={e => updateSlot(schema.id, idx, e.target.value)}
                      className={styles.slotSelect}
                    >
                      {angleOptions.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </span>
                ))}
              </div>
              <div className={styles.schemaActions}>
                <Btn size="sm" onClick={() => addSlot(schema.id)} title="Ajouter un angle">+</Btn>
                <Btn size="sm" onClick={() => removeSlot(schema.id)} title="Retirer">−</Btn>
                <Btn size="sm" variant="danger" onClick={() => removeSchema(schema.id)}>✕</Btn>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Divider />

      <SectionTitle>Matrice de compatibilité</SectionTitle>
      <p className={styles.hint}>Cliquez sur une cellule pour basculer : ✓ autorisé → ~ rare → ✕ exclu</p>

      {angles.length < 2 ? (
        <EmptyState>Ajoutez au moins 2 angles dans le Bloc 1</EmptyState>
      ) : (
        <div className={styles.matrixWrap}>
          <div
            className={styles.compatGrid}
            style={{ gridTemplateColumns: `140px repeat(${angles.length}, 1fr)` }}
          >
            <div className={`${styles.cell} ${styles.cellHeader}`}></div>
            {angles.map(a => (
              <div key={a.id} className={`${styles.cell} ${styles.cellHeader}`}>{a.name}</div>
            ))}
            {angles.map((ra) => (
              <>
                <div key={`row-${ra.id}`} className={`${styles.cell} ${styles.cellHeader}`}>{ra.name}</div>
                {angles.map(ca => (
                  ra.id === ca.id
                    ? <div key={`${ra.id}-${ca.id}`} className={`${styles.cell} ${styles.cellSelf}`}>—</div>
                    : (
                      <div
                        key={`${ra.id}-${ca.id}`}
                        className={`${styles.cell} ${styles[`cell-${getCompat(ra.id, ca.id)}`]}`}
                        onClick={() => cycleCompat(ra.id, ca.id)}
                      >
                        {COMPAT_LABELS[getCompat(ra.id, ca.id)]}
                      </div>
                    )
                ))}
              </>
            ))}
          </div>
          <div className={styles.legend}>
            <span><span className={`${styles.dot} ${styles.dotOk}`}></span> Autorisé</span>
            <span><span className={`${styles.dot} ${styles.dotRare}`}></span> Rare</span>
            <span><span className={`${styles.dot} ${styles.dotNo}`}></span> Exclu</span>
          </div>
        </div>
      )}

      <Divider />

      <div className={styles.genHeader}>
        <SectionTitle>Mots-clés générés</SectionTitle>
        <Btn variant="primary" size="sm" onClick={generate}>Générer les croisements</Btn>
      </div>

      {keywords.length === 0 ? (
        <EmptyState>Cliquez sur "Générer les croisements" pour produire la liste</EmptyState>
      ) : (
        <div>
          <div className={styles.kwCount}>{keywords.length} mots-clés générés</div>
          <div className={styles.kwGrid}>
            {keywords.slice(0, 50).map(k => (
              <div key={k.kw} className={styles.kwChip}>{k.kw}</div>
            ))}
            {keywords.length > 50 && (
              <div className={styles.kwMore}>+{keywords.length - 50} autres → Bloc 3</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
