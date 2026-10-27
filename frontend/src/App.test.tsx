import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const mockFetch = vi.fn()
const expressionInput = () => screen.getByRole('textbox', { name: 'Your expression' })
const submitButton = () => screen.getByRole('button', { name: 'Calculate' })
const reply = (body: unknown, ok = true) => ({ ok, json: async () => body })

beforeEach(() => { mockFetch.mockReset(); vi.stubGlobal('fetch', mockFetch) })
afterEach(() => vi.unstubAllGlobals())

describe('calculator form', () => {
  it('starts at zero, submits it, and resets the expression and result on Clear', async () => {
    mockFetch.mockResolvedValue(reply({ result: 0 }))
    const user = userEvent.setup()
    render(<App />)
    expect(expressionInput()).toHaveValue('0')
    await user.click(submitButton())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0'))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ expression: '0' })
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(expressionInput()).toHaveValue('0')
    expect(screen.getByRole('status')).toHaveTextContent('—')
    expect(expressionInput()).toHaveFocus()
  })

  it.each([
    ['7', '7'], ['0', '0'], ['Open parenthesis', '('], ['Close parenthesis', ')'],
    ['Add', '0+'], ['Subtract', '0-'], ['Multiply', '0*'], ['Divide', '0/'],
    ['Power', '0^()'], ['Percentage', '0%'], ['.', '0.'], ['Square root', 'sqrt()'],
  ])('handles the initial and cleared zero with the %s keypad key', async (name, expected) => {
    const user = userEvent.setup()
    render(<App />)
    for (const reset of [false, true]) {
      if (reset) await user.click(screen.getByRole('button', { name: 'Clear' }))
      await user.click(screen.getByRole('button', { name }))
      expect(expressionInput()).toHaveValue(expected)
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    ['123', '123'], ['(2+3)', '(2+3)'], [')', ')'], ['0', '0'],
    ['+2', '0+2'], ['-2', '0-2'], ['*2', '0*2'], ['/2', '0/2'],
    ['^2', '0^2'], ['%', '0%'], ['.5', '0.5'], ['sqrt(9)', 'sqrt(9)'],
  ])('handles keyboard entry %s after starting or clearing', async (keys, expected) => {
    const user = userEvent.setup()
    render(<App />)
    for (const reset of [false, true]) {
      if (reset) await user.click(screen.getByRole('button', { name: 'Clear' }))
      await user.type(expressionInput(), keys)
      expect(expressionInput()).toHaveValue(expected)
    }
  })

  it('preserves zeros within an existing expression', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(expressionInput(), '10+0')
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(expressionInput()).toHaveValue('10+02')
  })

  it('inserts a balanced exponent at the cursor and keeps surrounding text', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '2+4')
    field.setSelectionRange(1, 1)
    await user.click(screen.getByRole('button', { name: 'Power' }))
    expect(field).toHaveValue('2^()+4')
    await waitFor(() => expect(field.selectionStart).toBe(3))
    expect(field.selectionEnd).toBe(3)
    expect(field).toHaveFocus()
    await user.keyboard('3')
    expect(field).toHaveValue('2^(3)+4')
  })

  it('wraps a selected exponent and places the cursor after its parentheses', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '2+3+4')
    field.setSelectionRange(1, 3)
    await user.click(screen.getByRole('button', { name: 'Power' }))
    expect(field).toHaveValue('2^(+3)+4')
    await waitFor(() => expect(field.selectionStart).toBe(6))
    expect(field.selectionEnd).toBe(6)
  })

  it.each([
    ['2+', 'Divide', '2/', 2], ['2-', 'Multiply', '2*', 2],
    ['2+', 'Subtract', '2-', 2], ['2-', 'Subtract', '2-', 2],
    ['2+', 'Power', '2^()', 3], ['2^', 'Power', '2^()', 3],
    ['2^', 'Add', '2+', 2], ['2^', 'Subtract', '2^-', 3],
    ['2*', 'Subtract', '2*-', 3], ['2/', 'Subtract', '2/-', 3],
    ['2*-', 'Divide', '2/', 2], ['2/-', 'Power', '2^()', 3],
    ['2*-', 'Subtract', '2*-', 3],
    ['50%', 'Percentage', '50%', 3], ['50%', 'Add', '50%+', 4],
    ['2+', 'Square root', '2+sqrt()', 7],
  ] as const)('edits %s with %s as %s and restores the caret', async (expression, name, expected, caret) => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, expression)
    await user.click(screen.getByRole('button', { name }))
    expect(field).toHaveValue(expected)
    await waitFor(() => {
      expect(field).toHaveFocus()
      expect(field.selectionStart).toBe(caret)
    })
    expect(field.selectionEnd).toBe(caret)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    ['Add', '2^(+)', 4], ['Subtract', '2^(-)', 4],
    ['Multiply', '2^(*)', 4], ['Divide', '2^(/)', 4],
    ['Percentage', '2^(%)', 4], ['Power', '2^(^())', 5],
  ] as const)('keeps existing %s insertion inside an empty power template', async (name, expected, caret) => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '2')
    await user.click(screen.getByRole('button', { name: 'Power' }))
    await waitFor(() => expect(field.selectionStart).toBe(3))
    await user.click(screen.getByRole('button', { name }))
    expect(field).toHaveValue(expected)
    await waitFor(() => expect(field.selectionStart).toBe(caret))
  })

  it('applies power substitution only after manually deleting its parentheses', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '2')
    await user.click(screen.getByRole('button', { name: 'Power' }))
    await waitFor(() => expect(field.selectionStart).toBe(3))
    await user.keyboard('{Delete}{Backspace}')
    expect(field).toHaveValue('2^')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(field).toHaveValue('2+')
  })

  it('preserves keyboard typing, selections, and editing within an expression', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '2+/')
    expect(field).toHaveValue('2+/')
    field.setSelectionRange(2, 3)
    await user.click(screen.getByRole('button', { name: 'Multiply' }))
    expect(field).toHaveValue('2+*')
    await waitFor(() => expect(field).toHaveFocus())
    field.setSelectionRange(2, 2)
    await user.click(screen.getByRole('button', { name: 'Divide' }))
    expect(field).toHaveValue('2+/*')
  })

  it('submits the corrected expression and keeps stale output cleared on later edits', async () => {
    mockFetch.mockResolvedValue(reply({ result: 1 }))
    const user = userEvent.setup()
    render(<App />)
    await user.type(expressionInput(), '2+')
    await user.click(screen.getByRole('button', { name: 'Divide' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(submitButton())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1'))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ expression: '2/2' })
    await user.type(expressionInput(), '+')
    await user.click(screen.getByRole('button', { name: 'Multiply' }))
    expect(expressionInput()).toHaveValue('2/2*')
    expect(screen.getByRole('status')).toHaveTextContent('—')
  })

  it('validates empty and overlong expressions without making requests', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.clear(expressionInput())
    await user.click(submitButton())
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an expression')
    expect(expressionInput()).toHaveFocus()
    fireEvent.change(expressionInput(), { target: { value: '1'.repeat(257) } })
    await user.click(submitButton())
    expect(screen.getByRole('alert')).toHaveTextContent('256 characters')
    expect(mockFetch).not.toHaveBeenCalled()
  })
  it('submits with Enter, shows zero, and clears stale results on edit', async () => {
    mockFetch.mockResolvedValue(reply({ result: 0 }))
    const user = userEvent.setup()
    render(<App />)
    await user.clear(expressionInput())
    await user.type(expressionInput(), ' 2-2 {Enter}')
    expect(await screen.findByRole('status')).toHaveTextContent('0')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ expression: ' 2-2 ' })
    await user.type(expressionInput(), '+1')
    expect(screen.getByRole('status')).toHaveTextContent('—')
  })
  it('disables entry and buttons while pending and shows the backend result', async () => {
    let resolve!: (value: ReturnType<typeof reply>) => void
    mockFetch.mockReturnValue(new Promise(done => { resolve = done }))
    const user = userEvent.setup()
    render(<App />)
    await user.type(expressionInput(), '2+3+5/4')
    await user.click(submitButton())
    expect(expressionInput()).toBeDisabled()
    expect(submitButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
    for (const name of ['Power', 'Square root', 'Percentage']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByRole('status')).toHaveTextContent('Working')
    await user.click(submitButton())
    expect(mockFetch).toHaveBeenCalledTimes(1)
    resolve(reply({ result: 6.25 }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('6.25'))
    expect(expressionInput()).toBeEnabled()
  })
  it('announces API errors and highlights the exact character, then clears on edit', async () => {
    mockFetch.mockResolvedValue(reply({ error: { message: 'Cannot divide by zero.', position: 2 } }, false))
    const user = userEvent.setup()
    render(<App />)
    await user.type(expressionInput(), '10/(3-3)')
    await user.click(submitButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot divide by zero.')
    expect(screen.getByRole('alert')).toHaveTextContent('position 3')
    await waitFor(() => expect((expressionInput() as HTMLInputElement).selectionStart).toBe(2))
    expect((expressionInput() as HTMLInputElement).selectionEnd).toBe(3)
    await user.type(expressionInput(), '+')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('shows an end-of-expression error and supports clearing the form', async () => {
    mockFetch.mockResolvedValue(reply({ error: { message: 'Expected a number.', position: 2 } }, false))
    const user = userEvent.setup()
    render(<App />)
    await user.type(expressionInput(), '2+')
    await user.click(submitButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('end of expression')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(expressionInput()).toHaveValue('0')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(expressionInput()).toHaveFocus()
  })
  it('shows network errors and allows retry', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network')).mockResolvedValueOnce(reply({ result: 1 }))
    const user = userEvent.setup()
    render(<App />)
    await user.type(expressionInput(), '1')
    await user.click(submitButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach')
    await user.click(submitButton())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('inserts keypad characters at the selected location', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '(2 + 3) * 4')
    field.setSelectionRange(1, 2)
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(field).toHaveValue('(7 + 3) * 4')
    await waitFor(() => expect(field.selectionStart).toBe(2))
    await user.click(screen.getByRole('button', { name: 'Backspace' }))
    expect(field).toHaveValue('( + 3) * 4')
  })
  it('backspaces an entire Unicode character or a selected span', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    fireEvent.change(field, { target: { value: '1💡' } })
    field.setSelectionRange(3, 3)
    await user.click(screen.getByRole('button', { name: 'Backspace' }))
    expect(field).toHaveValue('1')
    field.setSelectionRange(0, 1)
    await user.click(screen.getByRole('button', { name: 'Backspace' }))
    expect(field).toHaveValue('')
  })
  it('inserts an empty square-root call and places the cursor inside', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.click(screen.getByRole('button', { name: 'Square root' }))
    expect(field).toHaveValue('sqrt()')
    await waitFor(() => expect(field.selectionStart).toBe(5))
    expect(field.selectionEnd).toBe(5)
    expect(field).toHaveFocus()
    await user.keyboard('9')
    expect(field).toHaveValue('sqrt(9)')
    expect(mockFetch).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(field).toHaveValue('0')
  })

  it('wraps a selected expression and preserves surrounding text', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '2+4+5*3')
    field.setSelectionRange(2, 5)
    await user.click(screen.getByRole('button', { name: 'Square root' }))
    expect(field).toHaveValue('2+sqrt(4+5)*3')
    await waitFor(() => expect(field.selectionStart).toBe(11))
    expect(field.selectionEnd).toBe(11)
    expect(field).toHaveFocus()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('inserts a square-root template at the cursor without inferring multiplication', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '2+3')
    field.setSelectionRange(1, 1)
    await user.click(screen.getByRole('button', { name: 'Square root' }))
    expect(field).toHaveValue('2sqrt()+3')
    await waitFor(() => expect(field.selectionStart).toBe(6))
  })

  it('inserts percentage at the selection and supports Backspace', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, '2+3')
    field.setSelectionRange(1, 2)
    await user.click(screen.getByRole('button', { name: 'Percentage' }))
    expect(field).toHaveValue('2%3')
    await waitFor(() => expect(field.selectionStart).toBe(2))
    await user.click(screen.getByRole('button', { name: 'Backspace' }))
    expect(field).toHaveValue('23')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    ['Power', '2', '3', '2^(3)', 8],
    ['Square root', '9', '', 'sqrt(9)', 3],
    ['Percentage', '200*10', '', '200*10%', 20],
  ] as const)('submits the exact expression from the %s control', async (name, initial, suffix, expression, result) => {
    mockFetch.mockResolvedValue(reply({ result }))
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, initial)
    if (name === 'Square root') field.setSelectionRange(0, initial.length)
    await user.click(screen.getByRole('button', { name }))
    await waitFor(() => expect(field).toHaveFocus())
    if (suffix) await user.keyboard(suffix)
    await user.click(submitButton())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(String(result)))
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ expression })
  })

  it.each([
    ['sqrt(-1)', 'Square root requires a nonnegative argument.', 0],
    ['0^0', 'Zero requires a positive exponent.', 1],
  ] as const)('displays the backend domain error for %s and selects its position', async (expression, message, position) => {
    mockFetch.mockResolvedValue(reply({ error: { code: 'INVALID_ARGUMENT', message, position } }, false))
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    await user.type(field, expression)
    await user.click(submitButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    await waitFor(() => expect(field.selectionStart).toBe(position))
    expect(field.selectionEnd).toBe(position + 1)
  })

  it('validates the length after square-root template insertion', async () => {
    const user = userEvent.setup()
    render(<App />)
    const field = expressionInput() as HTMLInputElement
    fireEvent.change(field, { target: { value: '1'.repeat(251) } })
    field.setSelectionRange(251, 251)
    await user.click(screen.getByRole('button', { name: 'Square root' }))
    expect(field.value.length).toBe(257)
    await user.click(submitButton())
    expect(screen.getByRole('alert')).toHaveTextContent('256 characters')
    expect(mockFetch).not.toHaveBeenCalled()
  })

})
