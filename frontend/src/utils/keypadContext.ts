// null means ignore this key. Otherwise return its contextual insertion text.
// Template keys remain named actions for Calculator to expand.
export function getContextualKey(expression: string, key: string, start: number, end: number): string | null {
  if (start !== end) return key

  const before = expression.slice(0, start).trimEnd()
  const previous = before.at(-1)
  const afterOpening = previous === '('
  const afterOpeningMinus = previous === '-' && before.slice(0, -1).trimEnd().endsWith('(')

  if (afterOpening || afterOpeningMinus) {
    if (['+', '*', '/', '%', '^', ')'].includes(key)) return null
    if (afterOpeningMinus && key === '-') return null
    if (key === '.') return '0.'
  }

  if ((previous === ')' || previous === '%') && /^[0-9]$/.test(key)) return `*${key}`
  return key
}
