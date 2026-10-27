const replacements: Record<string, string> = {
  '+': '+-*/%^',
  '-': '-+*/%^',
  '*': '*+/%^',
  '/': '/+*%^',
  '%': '%',
  '^': '^+*/%',
}

// Return the insertion start; moving it left replaces the pending operator.
// Selections, edits within an expression, and balanced templates stay literal.
export function getOperatorReplacementStart(expression: string, key: string, start: number, end: number): number {
  if (start !== end || end !== expression.length) return start
  const trailing = expression.at(-1) ?? ''
  if (!replacements[trailing]?.includes(key)) return start

  let from = start - 1
  if (trailing === '-' && key !== '-') {
    const prefix = expression.slice(0, from).trimEnd()
    const previous = prefix.at(-1)
    // Replace the whole unfinished operation in e.g. "2*-", not just its sign.
    if (previous === '*' || previous === '/' || previous === '^') from = prefix.length - 1
  }
  return from
}
