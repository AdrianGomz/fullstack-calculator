import type { Ref } from 'react'

interface ExpressionInputProps {
  inputRef: Ref<HTMLInputElement>
  expression: string
  pending: boolean
  hasError: boolean
  onChange: (value: string) => void
}

export default function ExpressionInput({ inputRef, expression, pending, hasError, onChange }: ExpressionInputProps) {
  const length = [...expression].length

  return (
    <div className="expression-wrap">
      <label htmlFor="expression">Your expression</label>
      <input
        ref={inputRef}
        id="expression"
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={expression}
        onChange={event => onChange(event.target.value)}
        disabled={pending}
        placeholder="e.g. (2 + 3) * 4"
        aria-invalid={hasError}
        aria-describedby={hasError ? 'expression-help percentage-help calculation-error' : 'expression-help percentage-help'}
      />
      <div className="input-meta">
        <span id="expression-help">Use + − * / ^, sqrt(...), % and parentheses</span>
        <span className={`character-count${length > 256 ? ' over-limit' : ''}`}>{length} / 256</span>
      </div>
      <p id="percentage-help" className="input-hint">
        10% = 0.1 · 200 × 10% = 20 · 200 + 10% = 200.1
      </p>
    </div>
  )
}
