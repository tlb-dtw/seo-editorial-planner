import styles from './UI.module.css'

export function Card({ children, style }) {
  return <div className={styles.card} style={style}>{children}</div>
}

export function SectionTitle({ children }) {
  return <div className={styles.sectionTitle}>{children}</div>
}

export function Btn({ children, onClick, variant = 'default', size = 'md', disabled, style }) {
  const cls = [
    styles.btn,
    styles[`btn-${variant}`],
    styles[`btn-${size}`],
    disabled ? styles.btnDisabled : ''
  ].filter(Boolean).join(' ')
  return (
    <button className={cls} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  )
}

export function Divider() {
  return <hr className={styles.divider} />
}

export function EmptyState({ children }) {
  return <div className={styles.emptyState}>{children}</div>
}

export function Badge({ children, variant = 'ok' }) {
  return <span className={`${styles.badge} ${styles[`badge-${variant}`]}`}>{children}</span>
}
