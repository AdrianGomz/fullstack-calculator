import type { Ref } from 'react'
import styles from './ExpressionInput.module.css'

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
    <div className={styles.wrapper}>
      <label htmlFor="expression">Your expression</label>
      <input
        className={styles.input}
        ref={inputRef}
        id="expression"
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={expression}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (expression !== '0' || event.ctrlKey || event.metaKey || event.altKey) return
          const field = event.currentTarget
          if (/^[0-9()s]$/.test(event.key)) {
            field.setSelectionRange(0, 1)
          } else if (/^[+\-*/^%.]$/.test(event.key) && field.selectionStart === field.selectionEnd) {
            field.setSelectionRange(1, 1)
          }
        }}
        disabled={pending}
        placeholder="e.g. (2 + 3) * 4"
        aria-invalid={hasError}
        aria-describedby={hasError ? 'expression-help percentage-help calculation-error' : 'expression-help percentage-help'}
      />
      <div className={styles.meta}>
        <span id="expression-help">Use + − * / ^, sqrt(...), % and parentheses</span>
        <span className={`${styles.characterCount}${length > 256 ? ` ${styles.overLimit}` : ''}`}>{length} / 256</span>
      </div>
    </div>
  )
}
