interface ResultPanelProps {
  result: number | null
  pending: boolean
  error: { message: string; position?: number } | null
  expressionLength: number
}

export default function ResultPanel({ result, pending, error, expressionLength }: ResultPanelProps) {
  return (
    <div className={`result-panel${error ? ' has-error' : ''}`}>
      <span className="small-label">
        {pending ? 'CALCULATING' : error ? 'LET’S TRY THAT AGAIN' : 'RESULT'}
      </span>
      <div className="result-value" role="status" aria-live="polite" aria-atomic="true">
        {pending ? (
          <span className="loading">Working<span>…</span></span>
        ) : result !== null ? String(result) : (
          <span className="empty-result">—</span>
        )}
      </div>
      {error ? (
        <p id="calculation-error" role="alert" className="error-message">
          {error.message}
          {error.position !== undefined && (
            <span className="error-position">
              {' '}Check position {error.position + 1}
              {error.position === expressionLength ? ' (end of expression)' : ''}.
            </span>
          )}
        </p>
      ) : (
        <p className="result-caption">
          {pending ? 'Finding your answer.' : result !== null ? 'There’s your answer.' : 'Your next answer starts here.'}
        </p>
      )}
    </div>
  )
}
