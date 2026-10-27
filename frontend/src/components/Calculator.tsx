import { useEffect, useRef, useState, type FormEvent } from 'react'
import { calculate, CalculationError } from '../api/calculator'
import { getOperatorReplacementStart } from '../utils/operatorSubstitution'
import ExpressionInput from './ExpressionInput'
import ResultPanel from './ResultPanel'
import Keypad from './Keypad'
import styles from './Calculator.module.css'

export default function Calculator() {
  const [expression, setExpression] = useState('0')
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
      update('0')
      field.focus()
      field.setSelectionRange(1, 1)
      return
    }
    const replacesZero = expression === '0' && (/^[0-9()]$/.test(key) || key === 'sqrt')
    let start = field.selectionStart ?? expression.length
    let end = field.selectionEnd ?? expression.length
    if (expression === '0' && key !== 'Backspace') {
      start = replacesZero ? 0 : 1
      end = 1
    }
    const replacementStart = getOperatorReplacementStart(expression, key, start, end)
    const replacingOperator = replacementStart !== start
    start = replacementStart
    let next: string
    let caret: number
    if (key === 'sqrt' || key === '^') {
      // A replaced operator is not a selected exponent to wrap.
      const selected = replacesZero || replacingOperator ? '' : expression.slice(start, end)
      const prefix = key === 'sqrt' ? 'sqrt(' : '^('
      const template = `${prefix}${selected})`
      next = expression.slice(0, start) + template + expression.slice(end)
      // Empty calls place the caret inside; wrapped selections place it after.
      caret = start + (selected ? template.length : prefix.length)
    } else if (key === 'Backspace') {
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
          onChange={update}
        />
        <ResultPanel
          result={result}
          pending={pending}
          error={error}
          expressionLength={[...expression].length}
        />
        <Keypad pending={pending} onKeyPress={insert} />
      </form>
      <div className={styles.footer}>
        <span aria-hidden="true">⌘</span> Your keyboard works here, too.
      </div>
    </section>
  )
}
