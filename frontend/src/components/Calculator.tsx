import { useEffect, useRef, useState, type FormEvent } from 'react'
import { calculate, CalculationError } from '../api/calculator'
import ExpressionInput from './ExpressionInput'
import ResultPanel from './ResultPanel'
import Keypad from './Keypad'

export default function Calculator() {
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
    if (key === 'sqrt') {
      const selected = expression.slice(start, end)
      const template = `sqrt(${selected})`
      next = expression.slice(0, start) + template + expression.slice(end)
      // Empty calls place the caret inside; wrapped selections place it after.
      caret = start + (selected ? template.length : 'sqrt('.length)
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
    <section className="calculator" aria-label="Calculator">
      <div className="calculator-heading">
        <span className="calculator-mark" aria-hidden="true">＋ − × ÷</span>
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
      <div className="calculator-footer">
        <span aria-hidden="true">⌘</span> Your keyboard works here, too.
      </div>
    </section>
  )
}
