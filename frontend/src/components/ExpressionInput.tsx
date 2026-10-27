import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import styles from './ExpressionInput.module.css'

interface ExpressionInputProps {
  inputRef: Ref<HTMLInputElement>
  expression: string
  pending: boolean
  hasError: boolean
  onKeyPress: (key: string) => void
  onInsertText: (text: string) => void
  onNativeChange: (value: string, start: number, end: number, inputType: string, data: string | null) => void
}

export default function ExpressionInput({ inputRef, expression, pending, hasError, onKeyPress, onInsertText, onNativeChange }: ExpressionInputProps) {
  const length = [...expression].length
  const field = useRef<HTMLInputElement>(null)
  useImperativeHandle(inputRef, () => field.current!, [])

  // Native beforeinput also covers virtual keyboards; onChange is the fallback
  // for non-cancelable input and browsers that do not send beforeinput.
  useEffect(() => {
    const element = field.current!
    function beforeInput(event: InputEvent) {
      if (!event.cancelable || event.isComposing) return
      if (pending) {
        event.preventDefault()
        return
      }
      if (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward') {
        event.preventDefault()
        onKeyPress(event.inputType === 'deleteContentBackward' ? 'Backspace' : 'Delete')
      } else if (event.inputType.startsWith('insert') && event.data !== null) {
        event.preventDefault()
        if (event.data === '=') element.form?.requestSubmit()
        else if (event.data.length === 1 && event.inputType === 'insertText') onKeyPress(event.data)
        else onInsertText(event.data)
      }
    }
    element.addEventListener('beforeinput', beforeInput)
    return () => element.removeEventListener('beforeinput', beforeInput)
  }, [onKeyPress, onInsertText, pending])

  return (
    <div className={styles.wrapper}>
      <label htmlFor="expression">Your expression</label>
      <input
        className={styles.input}
        ref={field}
        id="expression"
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={expression}
        onChange={event => {
          const native = event.nativeEvent as InputEvent
          onNativeChange(event.target.value, event.target.selectionStart ?? 0, event.target.selectionEnd ?? 0, native.inputType ?? '', native.data ?? null)
        }}
        onPaste={event => {
          event.preventDefault()
          onInsertText(event.clipboardData.getData('text/plain'))
        }}
        onDrop={event => {
          event.preventDefault()
          onInsertText(event.dataTransfer.getData('text/plain'))
        }}
        onKeyDown={event => {
          if (event.ctrlKey || event.metaKey) return
          if (event.key === '=') {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          } else if (event.key.length === 1 || (!event.altKey && ['Backspace', 'Delete'].includes(event.key))) {
            event.preventDefault()
            onKeyPress(event.key)
          }
        }}
        disabled={pending}
        placeholder="e.g. (2+3)*4"
        aria-invalid={hasError}
        aria-describedby={hasError ? 'expression-help calculation-error' : 'expression-help'}
      />
      <div className={styles.meta}>
        <span id="expression-help">Type numbers, + − * / ^ %, . and parentheses. Use s for square root.</span>
        <span className={`${styles.characterCount}${length > 256 ? ` ${styles.overLimit}` : ''}`}>{length} / 256</span>
      </div>
    </div>
  )
}
