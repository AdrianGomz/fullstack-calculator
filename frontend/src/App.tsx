import { useEffect, useRef, useState, type FormEvent } from 'react'
import { calculate, CalculationError } from './api/calculator'

const keys = ['(', ')', 'Clear', 'Backspace', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '+', '=']
const labels: Record<string, string> = { '/': 'Divide', '*': 'Multiply', '-': 'Subtract', '+': 'Add', '=': 'Calculate', '(': 'Open parenthesis', ')': 'Close parenthesis' }
const symbols: Record<string, string> = { '/': '÷', '*': '×', '-': '−', Backspace: '⌫' }

export default function App() {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState<number | null>(null)
  const [error, setError] = useState<CalculationError | null>(null)
  const [pending, setPending] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!error || pending || !input.current) return
    input.current.focus()
    if (error.position !== undefined) {
      const characters = [...expression]
      const start = characters.slice(0, error.position).join('').length
      const end = start + (characters[error.position]?.length ?? 0)
      input.current.setSelectionRange(start, end)
    }
  }, [error, pending, expression])

  useEffect(() => {
    if (result !== null && !pending) input.current?.focus()
  }, [result, pending])

  function update(value: string) {
    setExpression(value)
    setResult(null)
    setError(null)
  }

  function insert(key: string) {
    const field = input.current
    if (!field || inFlight.current) return
    if (key === 'Clear') {
      update('')
      field.focus()
      return
    }
    const start = field.selectionStart ?? expression.length
    const end = field.selectionEnd ?? expression.length
    let next: string
    let caret: number
    if (key === 'Backspace') {
      // Input selection uses UTF-16 offsets; remove a whole code point.
      const previous = [...expression.slice(0, start)].pop()?.length ?? 0
      const from = start === end ? start - previous : start
      next = expression.slice(0, from) + expression.slice(end)
      caret = from
    } else {
      next = expression.slice(0, start) + key + expression.slice(end)
      caret = start + key.length
    }
    update(next)
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(caret, caret)
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    setResult(null)
    if (!expression.trim()) {
      setError(new CalculationError('Enter an expression to calculate.'))
      return
    }
    if ([...expression].length > 256) {
      setError(new CalculationError('Keep your expression to 256 characters or fewer.', 256))
      return
    }
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      setResult(await calculate(expression))
    } catch (caught) {
      setError(caught instanceof CalculationError ? caught : new CalculationError('Something went wrong. Please try again.'))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="./" aria-label="Calculator home"><span className="brand-icon" aria-hidden="true">c</span>alculator<span className="wordmark-dot">.</span></a>
      </header>
      <main>
        <section className="calculator" aria-label="Calculator">
          <div className="calculator-heading"><span className="calculator-mark" aria-hidden="true">＋ − × ÷</span></div>
          <form onSubmit={submit} aria-busy={pending}>
            <div className="expression-wrap">
              <label htmlFor="expression">Your expression</label>
              <input ref={input} id="expression" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false}
                value={expression} onChange={event => update(event.target.value)} disabled={pending}
                placeholder="e.g. (2 + 3) * 4" aria-invalid={!!error} aria-describedby={error ? 'expression-help calculation-error' : 'expression-help'} />
              <div className="input-meta"><span id="expression-help">Use + − * / and parentheses</span><span className={[...expression].length > 256 ? 'over-limit' : ''}>{[...expression].length} / 256</span></div>
            </div>
            <div className={`result-panel${error ? ' has-error' : ''}`}>
              <span className="small-label">{pending ? 'CALCULATING' : error ? 'LET’S TRY THAT AGAIN' : 'RESULT'}</span>
              <div className="result-value" role="status" aria-live="polite" aria-atomic="true">{pending ? <span className="loading">Working<span>…</span></span> : result !== null ? String(result) : <span className="empty-result">—</span>}</div>
              {error ? <p id="calculation-error" role="alert" className="error-message">{error.message}{error.position !== undefined && <span className="error-position"> Check position {error.position + 1}{error.position === [...expression].length ? ' (end of expression)' : ''}.</span>}</p> : <p className="result-caption">{pending ? 'Finding your answer.' : result !== null ? 'There’s your answer.' : 'Your next answer starts here.'}</p>}
            </div>
            <fieldset className="keypad" disabled={pending}>
              <legend className="sr-only">Calculator keypad</legend>
              {keys.map(key => <button key={key} type={key === '=' ? 'submit' : 'button'} aria-label={labels[key] ?? key}
                className={`key ${key === '=' ? 'equals' : ['/', '*', '-', '+'].includes(key) ? 'operator' : ['(', ')', 'Clear', 'Backspace'].includes(key) ? 'utility' : ''}`}
                onClick={key === '=' ? undefined : () => insert(key)}>{symbols[key] ?? key}</button>)}
            </fieldset>
          </form>
          <div className="calculator-footer"><span aria-hidden="true">⌘</span> Your keyboard works here, too.</div>
        </section>
      </main>
      <footer className="site-footer"><span>By: Isaac Gomez Ocon.</span></footer>
    </div>
  )
}
