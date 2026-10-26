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
        aria-describedby={hasError ? 'expression-help calculation-error' : 'expression-help'}
      />
      <div className="input-meta">
        <span id="expression-help">Use + − * / and parentheses</span>
        <span className={length > 256 ? 'over-limit' : ''}>{length} / 256</span>
      </div>
    </div>
  )
}
