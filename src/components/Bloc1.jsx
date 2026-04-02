import { useState } from 'react'
import { Card, SectionTitle, Btn, Divider } from './UI.jsx'
import styles from './Bloc1.module.css'

function getTerms(angle) {
  return angle.terms.split('\n').map(t => t.trim()).filter(Boolean)
}

function ScoreDots({ score, onChange }) {
  return (
    <div className={styles.scoreDots}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          className={`${styles.scoreDot} ${score >= i ? styles.scoreDotFilled : ''}`}
          onClick={() => onChange(i)}
          title={`Poids ${i}/5`}
        />
      ))}
    </div>
  )
}

async function callClaude(apiKey, prompt) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    let detail = ''
    try { const err = await res.json(); detail = err.error?.message || '' } catch {}
    throw new Error(`${res.status}${detail ? ' — ' + detail : ''}`)
  }
  const data = await res.json()
  return data.content[0].text
}

export default function Bloc1({ generique, apiKey, angles, setAngles, nextAngleId, setNextAngleId }) {
  const [loadingAngles, setLoadingAngles] = useState(false)
  const [loadingTerms, setLoadingTerms] = useState(null)
  const [error, setError] = useState('')

  function addAngle() {
    setAngles(prev => [...prev, { id: nextAngleId, name: 'Nouvel angle', score: 3, terms: '' }])
    setNextAngleId(n => n + 1)
  }

  function removeAngle(id) {
    setAngles(prev => prev.filter(a => a.id !== id))
  }

  function updateAngle(id, key, value) {
    setAngles(prev => prev.map(a => a.id === id ? { ...a, [key]: value } : a))
  }

  async function suggestAngles() {
    if (!apiKey) { setError('Clé API requise pour les suggestions IA'); return }
    setError('')
    setLoadingAngles(true)
    try {
      const prompt = `Tu es un expert SEO. Pour le terme générique "${generique}", liste les angles sémantiques pertinents (dimensions qui qualifient ce produit/service dans les recherches Google).

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans backticks, sans texte avant ou après :
{"angles":[{"name":"Cible","score":5},{"name":"Couleur","score":4},...]}

Règles :
- 6 à 10 angles maximum
- Noms en français, courts (1-2 mots)
- Score de 1 à 5 selon l'importance SEO
- Angles vraiment utiles pour "${generique}"`

      const text = await callClaude(apiKey, prompt)
      const clean = text.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim()
      const parsed = JSON.parse(clean)
      const newAngles = parsed.angles.map((a, i) => ({
        id: nextAngleId + i,
        name: a.name,
        score: a.score || 3,
        terms: '',
      }))
      setAngles(newAngles)
      setNextAngleId(n => n + newAngles.length)
    } catch (e) {
      setError('Erreur API : ' + e.message)
    } finally {
      setLoadingAngles(false)
    }
  }

  async function suggestTerms(angle) {
    if (!apiKey) { setError('Clé API requise pour les suggestions IA'); return }
    setError('')
    setLoadingTerms(angle.id)
    try {
      const prompt = `Tu es un expert SEO. Pour le terme générique "${generique}" et l'angle "${angle.name}", liste les valeurs/attributs les plus recherchés sur Google.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans backticks :
{"terms":["terme1","terme2","terme3",...]}

Règles STRICTES :
- 6 à 15 valeurs maximum
- En français, minuscules, sans accents si possible
- CRUCIAL : retourne UNIQUEMENT la valeur de l'attribut, SANS JAMAIS inclure le terme générique "${generique}"
- Correct pour angle "Cible" : ["homme","femme","enfant","fille","ado","bebe"]
- INCORRECT : ["${generique} homme","${generique} femme"] — ne jamais préfixer avec le générique
- Ces valeurs seront combinées automatiquement avec "${generique}" lors de la génération des mots-clés`

      const text = await callClaude(apiKey, prompt)
      const clean = text.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim()
      const parsed = JSON.parse(clean)
      updateAngle(angle.id, 'terms', parsed.terms.join('\n'))
    } catch (e) {
      setError('Erreur API : ' + e.message)
    } finally {
      setLoadingTerms(null)
    }
  }

  async function suggestAllTerms() {
    if (!apiKey) { setError('Clé API requise'); return }
    setError('')
    for (const angle of angles) {
      await suggestTerms(angle)
    }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageEyebrow}>Étape 2 — Matrice sémantique</div>
          <h2 className={styles.pageTitle}>Angles & attributs pour <span className={styles.accentText}>{generique || '…'}</span></h2>
        </div>
        {apiKey && (
          <div className={styles.aiActions}>
            <Btn size="sm" onClick={suggestAngles} disabled={loadingAngles}>
              {loadingAngles ? '⟳ Génération…' : '✦ Suggérer les angles'}
            </Btn>
            <Btn size="sm" onClick={suggestAllTerms} disabled={!!loadingTerms || angles.length === 0}>
              {loadingTerms ? '⟳ En cours…' : '✦ Remplir tous les attributs'}
            </Btn>
          </div>
        )}
      </div>

      {!apiKey && (
        <div className={styles.noApiBanner}>
          <span>✦</span>
          Ajoutez une clé API Claude à l'étape 1 pour activer les suggestions automatiques d'angles et d'attributs.
        </div>
      )}

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.anglesHeader}>
        <SectionTitle>Angles sémantiques ({angles.length})</SectionTitle>
        <Btn size="sm" onClick={addAngle}>+ Angle</Btn>
      </div>

      <div className={styles.anglesGrid}>
        {angles.map(angle => (
          <div key={angle.id} className={styles.angleCard}>
            <div className={styles.angleHeader}>
              <input
                className={styles.angleName}
                value={angle.name}
                onChange={e => updateAngle(angle.id, 'name', e.target.value)}
                placeholder="Nom"
              />
              <Btn size="sm" variant="danger" onClick={() => removeAngle(angle.id)}>✕</Btn>
            </div>
            <div className={styles.scoreRow}>
              <span className={styles.scoreLabel}>Poids</span>
              <ScoreDots score={angle.score} onChange={v => updateAngle(angle.id, 'score', v)} />
              <span className={styles.scoreVal}>{angle.score}/5</span>
            </div>
            <div className={styles.termsRow}>
              <textarea
                className={styles.termsArea}
                value={angle.terms}
                onChange={e => updateAngle(angle.id, 'terms', e.target.value)}
                placeholder={'un terme par ligne\nex :\nhomme\nfemme\nenfant'}
              />
              {apiKey && (
                <button
                  className={`${styles.aiTermsBtn} ${loadingTerms === angle.id ? styles.aiTermsBtnLoading : ''}`}
                  onClick={() => suggestTerms(angle)}
                  disabled={loadingTerms === angle.id}
                  title="Suggérer les attributs via IA"
                >
                  {loadingTerms === angle.id ? '⟳' : '✦'}
                </button>
              )}
            </div>
            <div className={styles.termsCount}>{getTerms(angle).length} valeur(s)</div>
          </div>
        ))}
        <button className={styles.addCard} onClick={addAngle}>
          <span className={styles.addCardIcon}>+</span>
          <span className={styles.addCardLabel}>Nouvel angle</span>
        </button>
      </div>

      <Divider />

      <SectionTitle>Aperçu de la matrice</SectionTitle>
      <div className={styles.tableWrap}>
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th>Générique</th>
              {angles.map(a => <th key={a.id}>{a.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {[...Array(Math.max(1, ...angles.map(a => getTerms(a).length)))].map((_, rowIdx) => (
              <tr key={rowIdx}>
                <td>{rowIdx === 0 ? (generique || '—') : ''}</td>
                {angles.map(a => {
                  const terms = getTerms(a)
                  return <td key={a.id}>{terms[rowIdx] || ''}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
