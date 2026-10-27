import { describe, expect, it } from 'vitest'
import { getContextualKey } from './keypadContext'

describe('keypad context', () => {
  it.each(['(', 'sqrt(', '2^(', '( - ', '(\t', 'sqrt( -\n'])('blocks invalid operators or empty closing after %j', expression => {
    for (const key of ['+', '*', '/', '%', '^', ')']) {
      expect(getContextualKey(expression, key, expression.length, expression.length)).toBeNull()
    }
    for (const key of ['0', '7', 'sqrt', '(', 'Backspace']) {
      expect(getContextualKey(expression, key, expression.length, expression.length)).toBe(key)
    }
    expect(getContextualKey(expression, '.', expression.length, expression.length)).toBe('0.')
  })

  it.each(['(', 'sqrt(', '2^('])('allows a single negative sign after %s', expression => {
    expect(getContextualKey(expression, '-', expression.length, expression.length)).toBe('-')
    const negative = expression + '-'
    expect(getContextualKey(negative, '-', negative.length, negative.length)).toBeNull()
  })

  it.each(['(2)', '50%', 'sqrt(9)', '2^(3)', '(2) \t', '50%\n'])('inserts multiplication before digits after %j', expression => {
    for (const key of ['0', '4', '9']) {
      expect(getContextualKey(expression, key, expression.length, expression.length)).toBe(`*${key}`)
    }
    for (const key of ['sqrt', '(', '.', '+', '-', 'Backspace']) {
      expect(getContextualKey(expression, key, expression.length, expression.length)).toBe(key)
    }
  })

  it('uses the cursor context and does not change selections', () => {
    expect(getContextualKey('2^()+5', '+', 3, 3)).toBeNull()
    expect(getContextualKey('sqrt()+5', '-', 5, 5)).toBe('-')
    expect(getContextualKey('(2)+5', '4', 3, 3)).toBe('*4')
    expect(getContextualKey('50%+5', '4', 3, 3)).toBe('*4')
    expect(getContextualKey('(2)', '+', 1, 2)).toBe('+')
    expect(getContextualKey('(2)+5', '4', 3, 4)).toBe('4')
  })

  it.each(['', '0', '12', '(2+3', '(0.5', '2*-'])('preserves ordinary insertion after %j', expression => {
    for (const key of ['4', '.', '-', '*', 'sqrt', 'Backspace']) {
      expect(getContextualKey(expression, key, expression.length, expression.length)).toBe(key)
    }
  })
})
