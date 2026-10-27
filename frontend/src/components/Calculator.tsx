import { useEffect, useRef, useState, type FormEvent } from 'react'
import { calculate, CalculationError } from '../api/calculator'
import useExpressionEditor from '../hooks/useExpressionEditor'
import ExpressionInput from './ExpressionInput'
import ResultPanel from './ResultPanel'
import Keypad from './Keypad'
import styles from './Calculator.module.css'

export default function Calculator() {
  const [result, setResult] = useState<number | null>(null)
  const [error, setError] = useState<CalculationError | null>(null)
  const [pending, setPending] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)
  const editor = useExpressionEditor(input, inFlight, () => {
    setResult(null)
    setError(null)
  })
  const { expression } = editor

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
    <section className={styles.calculator} aria-label="Calculator">
      <div className={styles.heading}>
        <span className={styles.mark} aria-hidden="true">＋ − × ÷</span>
      </div>
      <form onSubmit={submit} aria-busy={pending}>
        <ExpressionInput
          inputRef={input}
          expression={expression}
          pending={pending}
          hasError={error !== null}
          onKeyPress={editor.key}
          onInsertText={editor.text}
          onNativeChange={editor.nativeChange}
        />
        <ResultPanel
          result={result}
          pending={pending}
          error={error}
          expressionLength={[...expression].length}
        />
        <Keypad pending={pending} onKeyPress={editor.key} />
      </form>
      <div className={styles.footer}>
        <span aria-hidden="true">⌘</span> Your keyboard works here, too.
      </div>
    </section>
  )
}
