import styles from './ResultPanel.module.css'

interface ResultPanelProps {
  result: number | null
  pending: boolean
  error: { message: string; position?: number } | null
  expressionLength: number
}

export default function ResultPanel({ result, pending, error, expressionLength }: ResultPanelProps) {
  return (
    <div className={`${styles.panel}${error ? ` ${styles.hasError}` : ''}`}>
      <span className={styles.label}>
        {pending ? 'CALCULATING' : error ? 'LET’S TRY THAT AGAIN' : 'RESULT'}
      </span>
      <div className={styles.value} role="status" aria-live="polite" aria-atomic="true">
        {pending ? (
          <span className={styles.loading}>Working<span>…</span></span>
        ) : result !== null ? String(result) : (
          <span className={styles.empty}>—</span>
        )}
      </div>
      {error ? (
        <p id="calculation-error" role="alert" className={styles.errorMessage}>
          {error.message}
          {error.position !== undefined && (
            <span className={styles.errorPosition}>
              {' '}Check position {error.position + 1}
              {error.position === expressionLength ? ' (end of expression)' : ''}.
            </span>
          )}
        </p>
      ) : (
        <p className={styles.caption}>
          {pending ? 'Finding your answer.' : result !== null ? 'There’s your answer.' : 'Your next answer starts here.'}
        </p>
      )}
    </div>
  )
}
