import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { editExpression, getExpressionChange, insertExpressionText, isExpressionText, type ExpressionSnapshot } from '../utils/expressionEditing'

const initial: ExpressionSnapshot = { value: '0', start: 1, end: 1 }

export default function useExpressionEditor(input: RefObject<HTMLInputElement | null>, locked: RefObject<boolean>, onEdit: () => void) {
  const [snapshot, setSnapshot] = useState(initial)
  const current = useRef(initial)
  const restorePending = useRef(false)

  function restore(value: ExpressionSnapshot) {
    const field = input.current
    if (!field) return
    field.value = value.value
    field.focus()
    field.setSelectionRange(value.start, value.end)
  }

  // Restore synchronously too, so rapid keys use the new caret before rendering.
  // The layout effect retains it after React updates the controlled value.
  useLayoutEffect(() => {
    if (restorePending.current) {
      restore(snapshot)
      restorePending.current = false
    }
  }, [snapshot])

  function selection(): ExpressionSnapshot {
    return {
      value: current.current.value,
      start: input.current?.selectionStart ?? current.current.start,
      end: input.current?.selectionEnd ?? current.current.end,
    }
  }

  function apply(before: ExpressionSnapshot, next: ExpressionSnapshot | null) {
    if (!next) {
      restore(before)
      return
    }
    current.current = next
    restorePending.current = true
    setSnapshot(next)
    restore(next)
    onEdit()
  }

  function key(key: string) {
    if (locked.current) return
    const before = selection()
    apply(before, editExpression(before, key))
  }

  function text(text: string) {
    if (locked.current) return
    const before = selection()
    apply(before, insertExpressionText(before, text))
  }

  // Fallback for autofill, composition, cut, and non-cancelable browser input.
  function nativeChange(value: string, start: number, end: number, inputType: string, data: string | null) {
    if (locked.current) {
      restore(current.current)
      return
    }
    const change = getExpressionChange(current.current.value, value)
    const before = { value: current.current.value, start: change.start, end: change.end }
    const rootShortcut = inputType === 'insertText' && data === 's'
    if (data !== null && !isExpressionText(data) && !rootShortcut) {
      restore(before)
      return
    }
    if (value === before.value) return
    if (!change.text) apply(before, { value, start, end })
    else if (change.text.length === 1 && !['insertFromPaste', 'insertFromDrop', 'insertReplacementText'].includes(inputType)) {
      apply(before, editExpression(before, change.text))
    } else apply(before, insertExpressionText(before, change.text))
  }

  return { expression: snapshot.value, key, text, nativeChange }
}
