import { useState } from 'react'
import { Btn } from './UI.jsx'
import styles from './Step0.module.css'

export default function Step0({ generique, setGenerique, apiKey, setApiKey, onNext }) {
  const [showKey, setShowKey] = useState(false)

  const canProceed = generique.trim().length > 0

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <div className={styles.eyebrow}>Étude sémantique</div>
        <h1 className={styles.title}>
          Du terme générique<br />
          au <span className={styles.accent}>planning éditorial</span>
        </h1>
        <p className={styles.sub}>
          Construisez une liste de mots-clés exhaustive, propre et priorisable<br />
          assistée par IA — en moins d'une heure.
        </p>
      </div>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>
            <span className={styles.labelNum}>01</span>
            Terme générique
          </label>
          <input
            type="text"
            className={styles.mainInput}
            value={generique}
            onChange={e => setGenerique(e.target.value.toLowerCase())}
            placeholder="ex : tshirt, aspirateur, vélo de route…"
            autoFocus
          />
          <div className={styles.fieldHint}>Le mot-clé racine à partir duquel l'étude sera construite</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <span className={styles.labelNum}>02</span>
            Clé API Claude
            <span className={styles.optional}>optionnel</span>
          </label>
          <div className={styles.keyRow}>
            <input
              type={showKey ? 'text' : 'password'}
              className={styles.keyInput}
              value={apiKey}
              onChange={e => setApiKey(e.target.value.trim())}
              placeholder="sk-ant-api03-…"
            />
            <button className={styles.toggleBtn} onClick={() => setShowKey(v => !v)}>
              {showKey ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          <div className={styles.fieldHint}>
            Permet les suggestions IA d'angles et d'attributs.
            {' '}<a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className={styles.link}>Obtenir une clé →</a>
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statVal}>5</span>
            <span className={styles.statLabel}>étapes guidées</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statVal}>1</span>
            <span className={styles.statLabel}>ligne = 1 page</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statVal}>IA</span>
            <span className={styles.statLabel}>suggestions auto</span>
          </div>
        </div>

        <Btn
          variant="primary"
          size="md"
          onClick={onNext}
          disabled={!canProceed}
          style={{ width: '100%', justifyContent: 'center', fontSize: '14px', padding: '12px' }}
        >
          Démarrer l'étude →
        </Btn>
      </div>
    </div>
  )
}
