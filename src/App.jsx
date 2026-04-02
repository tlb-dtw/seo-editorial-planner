import { useState } from 'react'
import Step0 from './components/Step0.jsx'
import Bloc1 from './components/Bloc1.jsx'
import Bloc2 from './components/Bloc2.jsx'
import Bloc3 from './components/Bloc3.jsx'
import Step4 from './components/Step4.jsx'
import styles from './App.module.css'

const INITIAL_ANGLES = []

const INITIAL_SCHEMAS = [
  { id: 1, slots: [0, 1] },
  { id: 2, slots: [0, 2] },
  { id: 3, slots: [0, 1, 2] },
]

const STEPS = [
  { id: 'setup',    label: 'Setup',     num: 1 },
  { id: 'matrice',  label: 'Matrice',   num: 2 },
  { id: 'requetes', label: 'Requêtes',  num: 3 },
  { id: 'export',   label: 'Export',    num: 4 },
  { id: 'dashboard',label: 'Dashboard', num: 5 },
]

export default function App() {
  const [step, setStep] = useState('setup')
  const [generique, setGenerique] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [angles, setAngles] = useState(INITIAL_ANGLES)
  const [schemas, setSchemas] = useState(INITIAL_SCHEMAS)
  const [compat, setCompat] = useState({})
  const [keywords, setKeywords] = useState([])
  const [nextAngleId, setNextAngleId] = useState(1)
  const [nextSchemaId, setNextSchemaId] = useState(4)

  const currentIdx = STEPS.findIndex(s => s.id === step)

  function goNext() {
    if (currentIdx < STEPS.length - 1) setStep(STEPS[currentIdx + 1].id)
  }
  function goPrev() {
    if (currentIdx > 0) setStep(STEPS[currentIdx - 1].id)
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>Étude Sémantique</span>
            <span className={styles.logoBadge}>V1</span>
          </div>
          <nav className={styles.tabs}>
            {STEPS.map(s => (
              <button
                key={s.id}
                className={`${styles.tab} ${step === s.id ? styles.tabActive : ''} ${STEPS.findIndex(x => x.id === s.id) > currentIdx ? styles.tabLocked : ''}`}
                onClick={() => STEPS.findIndex(x => x.id === s.id) <= currentIdx && setStep(s.id)}
              >
                <span className={styles.tabNum}>{s.num}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {step === 'setup' && (
          <Step0
            generique={generique}
            setGenerique={setGenerique}
            apiKey={apiKey}
            setApiKey={setApiKey}
            onNext={goNext}
          />
        )}
        {step === 'matrice' && (
          <>
            <Bloc1
              generique={generique}
              apiKey={apiKey}
              angles={angles}
              setAngles={setAngles}
              nextAngleId={nextAngleId}
              setNextAngleId={setNextAngleId}
            />
            <div className={styles.navRow}>
              <button className={styles.navBtn} onClick={goPrev}>← Retour</button>
              <button className={styles.navBtnPrimary} onClick={goNext} disabled={angles.length === 0}>Continuer →</button>
            </div>
          </>
        )}
        {step === 'requetes' && (
          <>
            <Bloc2
              generique={generique}
              angles={angles}
              schemas={schemas}
              setSchemas={setSchemas}
              compat={compat}
              setCompat={setCompat}
              keywords={keywords}
              setKeywords={setKeywords}
              nextSchemaId={nextSchemaId}
              setNextSchemaId={setNextSchemaId}
            />
            <div className={styles.navRow}>
              <button className={styles.navBtn} onClick={goPrev}>← Retour</button>
              <button className={styles.navBtnPrimary} onClick={goNext} disabled={keywords.length === 0}>Continuer →</button>
            </div>
          </>
        )}
        {step === 'export' && (
          <>
            <Bloc3
              generique={generique}
              keywords={keywords}
              setKeywords={setKeywords}
            />
            <div className={styles.navRow}>
              <button className={styles.navBtn} onClick={goPrev}>← Retour</button>
              <button className={styles.navBtnPrimary} onClick={goNext}>Vers le dashboard →</button>
            </div>
          </>
        )}
        {step === 'dashboard' && (
          <Step4
            generique={generique}
            keywords={keywords}
            angles={angles}
          />
        )}
      </main>
    </div>
  )
}
