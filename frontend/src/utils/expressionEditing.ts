import { getContextualKey } from './keypadContext'
import { getOperatorReplacementStart } from './operatorSubstitution'

export interface ExpressionSnapshot {
  value: string
  start: number
  end: number
}

export const isExpressionText = (text: string) => /^[0-9+\-*/^%().]*$/.test(text)

export function editExpression(before: ExpressionSnapshot, key: string): ExpressionSnapshot | null {
  if (key === 's') key = 'sqrt'
  const { value } = before
  let { start, end } = before
  if (key === 'Clear') return { value: '0', start: 1, end: 1 }
  if (key === 'Backspace' || key === 'Delete') {
    // DOM selections use UTF-16 offsets; delete complete code points.
    if (start === end) {
      if (key === 'Backspace') start -= [...value.slice(0, start)].pop()?.length ?? 0
      else end += [...value.slice(end)][0]?.length ?? 0
    }
    if (start === end) return null
    return { value: value.slice(0, start) + value.slice(end), start, end: start }
  }
  if (key !== 'sqrt' && (key.length !== 1 || !isExpressionText(key))) return null

  const replacesZero = value === '0' && (/^[0-9()]$/.test(key) || key === 'sqrt')
  if (value === '0') {
    start = replacesZero ? 0 : 1
    end = 1
  }
  const text = getContextualKey(value, key, start, end)
  if (text === null) return null
  const from = getOperatorReplacementStart(value, key, start, end)
  if (key === 'sqrt' || key === '^') {
    const selected = replacesZero || from !== start ? '' : value.slice(start, end)
    const prefix = key === 'sqrt' ? 'sqrt(' : '^('
    const template = `${prefix}${selected})`
    const caret = from + (selected ? template.length : prefix.length)
    return { value: value.slice(0, from) + template + value.slice(end), start: caret, end: caret }
  }
  const caret = from + text.length
  return { value: value.slice(0, from) + text + value.slice(end), start: caret, end: caret }
}

export function insertExpressionText(before: ExpressionSnapshot, text: string): ExpressionSnapshot | null {
  if (!text || !isExpressionText(text)) return null
  const start = before.value === '0' ? 0 : before.start
  const end = before.value === '0' ? 1 : before.end
  const caret = start + text.length
  return { value: before.value.slice(0, start) + text + before.value.slice(end), start: caret, end: caret }
}

// Compare only the changed span, preserving button-created sqrt text elsewhere.
export function getExpressionChange(previous: string, next: string) {
  let start = 0
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++
  let end = previous.length
  let nextEnd = next.length
  while (end > start && nextEnd > start && previous[end - 1] === next[nextEnd - 1]) {
    end--
    nextEnd--
  }
  return { start, end, text: next.slice(start, nextEnd) }
}
