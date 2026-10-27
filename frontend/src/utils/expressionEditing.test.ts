import { describe, expect, it } from 'vitest'
import { editExpression, getExpressionChange, insertExpressionText } from './expressionEditing'

describe('shared expression editing', () => {
  it.each([
    ['(2)4', 4, 4, 'Backspace', '(2)', 3],
    ['sqrt(9)', 5, 6, 'Delete', 'sqrt()', 5],
    ['12', 0, 0, 'Delete', '2', 0],
    ['12', 0, 2, 'Backspace', '', 0],
    ['1💡', 3, 3, 'Backspace', '1', 1],
    ['💡1', 0, 0, 'Delete', '1', 0],
  ] as const)('deletes from %s with %s', (value, start, end, key, expected, caret) => {
    expect(editExpression({ value, start, end }, key)).toEqual({ value: expected, start: caret, end: caret })
  })

  it.each(['a', 'S', 'sqrt(9)', '√', ' ', '\n', '💡', 'e', '=', '×', '01'])('rejects non-action key %j', key => {
    expect(editExpression({ value: 'sqrt(9)', start: 6, end: 6 }, key)).toBeNull()
  })

  it('ignores deletion at the input boundaries', () => {
    expect(editExpression({ value: '12', start: 0, end: 0 }, 'Backspace')).toBeNull()
    expect(editExpression({ value: '12', start: 2, end: 2 }, 'Delete')).toBeNull()
  })

  it('preserves pasted precedence, selection, and literal operators', () => {
    expect(insertExpressionText({ value: '0', start: 1, end: 1 }, '2^3+4')).toEqual({ value: '2^3+4', start: 5, end: 5 })
    expect(insertExpressionText({ value: 'sqrt(9)', start: 5, end: 6 }, '16')).toEqual({ value: 'sqrt(16)', start: 7, end: 7 })
    expect(insertExpressionText({ value: '2+', start: 2, end: 2 }, '/')).toEqual({ value: '2+/', start: 3, end: 3 })
  })

  it.each(['1a2', 's', 'sqrt(9)', '√9', '1 2', '1\n2', '2=3', '２', ''])('rejects the entire paste %j', text => {
    expect(insertExpressionText({ value: '123', start: 0, end: 3 }, text)).toBeNull()
  })

  it.each([
    ['sqrt(9)', 'sqrt(16)', { start: 5, end: 6, text: '16' }],
    ['12', '1', { start: 1, end: 2, text: '' }],
    ['12', '12', { start: 2, end: 2, text: '' }],
    ['(2)', '(+2)', { start: 1, end: 1, text: '+' }],
  ] as const)('finds inserted text between %s and %s', (before, after, expected) => {
    expect(getExpressionChange(before, after)).toEqual(expected)
  })
})
