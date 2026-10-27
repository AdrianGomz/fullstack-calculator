import { describe, expect, it } from 'vitest'
import { getOperatorReplacementStart } from './operatorSubstitution'

describe('trailing keypad operator substitution', () => {
  const keys = ['+', '-', '*', '/', '%', '^']

  it.each([
    ['2+', ['2+', '2-', '2*', '2/', '2%', '2^']],
    ['2-', ['2+', '2-', '2*', '2/', '2%', '2^']],
    ['2*', ['2+', '2*-', '2*', '2/', '2%', '2^']],
    ['2/', ['2+', '2/-', '2*', '2/', '2%', '2^']],
    ['50%', ['50%+', '50%-', '50%*', '50%/', '50%', '50%^']],
    ['2^', ['2+', '2^-', '2*', '2/', '2%', '2^']],
  ] as const)('applies the complete substitution matrix after %s', (expression, expected) => {
    keys.forEach((key, index) => {
      const from = getOperatorReplacementStart(expression, key, expression.length, expression.length)
      // Power's balanced template is added by Calculator, after substitution.
      expect(expression.slice(0, from) + key).toBe(expected[index])
    })
  })

  it.each(['2*-', '2/-', '2^-', '2* -'])('replaces the unfinished operation in %s while retaining a repeated minus', expression => {
    const from = getOperatorReplacementStart(expression, '/', expression.length, expression.length)
    expect(expression.slice(0, from) + '/').toBe('2/')
    const minus = getOperatorReplacementStart(expression, '-', expression.length, expression.length)
    expect(expression.slice(0, minus) + '-').toBe(expression)
  })

  it.each([
    ['2^()', '+', 3, 3], ['2^()', '^', 5, 5], ['2^(3)', '*', 6, 6],
    ['2+3', '/', 2, 2], ['2+', '*', 1, 2], ['2+', '*', 0, 2],
    ['2+', 'sqrt', 2, 2], ['2+', '7', 2, 2], ['2+', 'Backspace', 2, 2],
    ['', '+', 0, 0], ['2', '+', 1, 1], ['(2)', '+', 3, 3],
  ] as const)('preserves normal insertion for %s / %s at [%i, %i]', (expression, key, start, end) => {
    expect(getOperatorReplacementStart(expression, key, start, end)).toBe(start)
  })
})
