import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const input = () => screen.getByRole('textbox', { name: 'Your expression' }) as HTMLInputElement
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ result: 12 }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('physical keyboard editing', () => {
  it.each([
    ['2+/', '2/'], ['2--', '2-'], ['2*-3', '2*-3'], ['2/-3', '2/-3'],
    ['50%%', '50%'], ['50%2', '50%*2'], ['(2)34', '(2)*34'],
    ['(+*/%^)', '('], ['(-*/+)', '(-'], ['(.5)', '(0.5)'],
    ['2^3', '2^(3)'], ['2^+*/%3', '2^(3)'],
    ['abc', '0'], ['qrteE√×÷−💡 ', '0'], ['s9', 'sqrt(9)'],
    ['2s9', '2*sqrt(9)'], ['2(3+4)', '2*(3+4)'], ['1.5s4', '1.5*sqrt(4)'],
    ['5.(2)', '5.*(2)'], ['2^3s9', '2^(3*sqrt(9))'],
    ['(2)(3+4)', '(2)*(3+4)'], ['(2)s9', '(2)*sqrt(9)'],
    ['s9{ArrowRight}(2)', 'sqrt(9)*(2)'], ['2^3{ArrowRight}(4)', '2^(3)*(4)'],
  ])('edits %j as %j', async (keys, expected) => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), keys)
    expect(input()).toHaveValue(expected)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the exact same operator matrix as the keypad, including bare power', async () => {
    const user = userEvent.setup()
    render(<App />)
    const cases = [
      ['2+', ['2+', '2-', '2*', '2/', '2%', '2^()']],
      ['2-', ['2+', '2-', '2*', '2/', '2%', '2^()']],
      ['2*', ['2+', '2*-', '2*', '2/', '2%', '2^()']],
      ['2/', ['2+', '2/-', '2*', '2/', '2%', '2^()']],
      ['50%', ['50%+', '50%-', '50%*', '50%/', '50%', '50%^()']],
      ['2^', ['2+', '2^-', '2*', '2/', '2%', '2^()']],
    ] as const
    for (const [expression, expected] of cases) {
      for (const [index, key] of ['+', '-', '*', '/', '%', '^'].entries()) {
        await user.clear(input())
        await user.paste(expression)
        await user.keyboard(key)
        expect(input()).toHaveValue(expected[index])
      }
    }
  })

  it('creates roots through the button and keeps their arguments editable', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Square root' }))
    await user.keyboard('+*^9')
    expect(input()).toHaveValue('sqrt(9)')
    expect(input().selectionStart).toBe(6)
    await user.keyboard('{Backspace}16')
    expect(input()).toHaveValue('sqrt(16)')
    await user.keyboard('{ArrowRight}2')
    expect(input()).toHaveValue('sqrt(16)*2')
  })

  it('keeps typed power balanced and restores the caret during rapid input', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), '2^-3')
    expect(input()).toHaveValue('2^(-3)')
    expect(input().selectionStart).toBe(5)
    await user.keyboard('{ArrowRight}+4')
    expect(input()).toHaveValue('2^(-3)+4')
    input().setSelectionRange(0, 1)
    await user.keyboard('5')
    expect(input()).toHaveValue('5^(-3)+4')
    await user.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: 'Open parenthesis' })).toHaveFocus()
  })

  it.each(['2a3', 's', 'sqrt(9)', '√(9)', '1 2', '1\n2', '1e3', '2=3'])('rejects the entire invalid paste %j without changing feedback or selection', async text => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), '12{Enter}')
    expect(await screen.findByRole('status')).toHaveTextContent('12')
    input().setSelectionRange(0, 2)
    await user.paste(text)
    expect(input()).toHaveValue('12')
    expect(input().selectionStart).toBe(0)
    expect(input().selectionEnd).toBe(2)
    expect(screen.getByRole('status')).toHaveTextContent('12')
    await user.keyboard('a')
    expect(input()).toHaveValue('12')
    expect(screen.getByRole('status')).toHaveTextContent('12')
  })

  it.each([
    ['2s9', '2*sqrt(9)', 6], ['2(3+4)', '2*(3+4)', 14],
    ['(2)s9', '(2)*sqrt(9)', 6], ['(2)(3+4)', '(2)*(3+4)', 14],
  ] as const)('submits explicit multiplication from typed %s', async (keys, expression, result) => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result }) })
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), keys + '=')
    expect(await screen.findByRole('status')).toHaveTextContent(String(result))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ expression })
  })

  it('keeps pasted grouping literal and preserves numeric selection wrapping', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(input())
    await user.paste('2(3+4)')
    expect(input()).toHaveValue('2(3+4)')
    await user.clear(input())
    await user.type(input(), '25')
    input().setSelectionRange(0, 2)
    await user.keyboard('s')
    expect(input()).toHaveValue('sqrt(25)')
  })

  it('preserves accepted paste precedence and submits with equals exactly once', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(input())
    await user.paste('2^3+4')
    expect(input()).toHaveValue('2^3+4')
    await user.keyboard('=')
    expect(await screen.findByRole('status')).toHaveTextContent('12')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ expression: '2^3+4' })
  })

  it('inserts literal pasted text into root arguments and rejects invalid drops', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Square root' }))
    await user.paste('16')
    expect(input()).toHaveValue('sqrt(16)')
    input().setSelectionRange(5, 7)
    fireEvent.drop(input(), { dataTransfer: { getData: () => '9x' } })
    expect(input()).toHaveValue('sqrt(16)')
    expect(input().selectionStart).toBe(5)
    expect(input().selectionEnd).toBe(7)
    fireEvent.drop(input(), { dataTransfer: { getData: () => '25' } })
    expect(input()).toHaveValue('sqrt(25)')
  })

  it('preserves native select-all, copy, and cut', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Square root' }))
    await user.keyboard('9')
    await user.keyboard('{Control>}a{/Control}')
    const copied = await user.copy()
    expect(copied?.getData('text/plain')).toBe('sqrt(9)')
    await user.cut()
    expect(input()).toHaveValue('')
  })

  it('does not intercept browser undo/redo shortcuts', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), '12')
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
      expect(fireEvent.keyDown(input(), { key: 'z', ...modifiers })).toBe(true)
      expect(fireEvent.keyDown(input(), { key: 'Z', shiftKey: true, ...modifiers })).toBe(true)
      expect(fireEvent.keyDown(input(), { key: 'y', ...modifiers })).toBe(true)
    }
    expect(input()).toHaveValue('12')
  })

  it('preserves navigation and forward/backward deletion', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), '123')
    await user.keyboard('{ArrowLeft}{Delete}')
    expect(input()).toHaveValue('12')
    await user.keyboard('{Backspace}')
    expect(input()).toHaveValue('1')
    input().setSelectionRange(0, 1)
    await user.keyboard('{Delete}')
    expect(input()).toHaveValue('')
  })

  it('wraps selected text with s and preserves surrounding text and the caret', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), '2+9*3')
    input().setSelectionRange(2, 3)
    await user.keyboard('s')
    expect(input()).toHaveValue('2+sqrt(9)*3')
    expect(input().selectionStart).toBe(9)
    expect(input().selectionEnd).toBe(9)
  })

  it('supports s inside parentheses and nested roots', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), '(ss16')
    expect(input()).toHaveValue('(sqrt(sqrt(16))')
    expect(input().selectionStart).toBe(13)
  })

  it('submits the function generated by s and leaves Ctrl/Cmd+S to the browser', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: 4 }) })
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), 's16=')
    expect(await screen.findByRole('status')).toHaveTextContent('4')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ expression: 'sqrt(16)' })
    expect(fireEvent.keyDown(input(), { key: 's', ctrlKey: true })).toBe(true)
    expect(fireEvent.keyDown(input(), { key: 's', metaKey: true })).toBe(true)
    expect(input()).toHaveValue('sqrt(16)')
  })

  it('supports s through virtual-keyboard input without permitting pasted function text', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(input())
    fireEvent(input(), new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: 's' }))
    expect(input()).toHaveValue('sqrt()')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    fireEvent.input(input(), { target: { value: '0s' }, inputType: 'insertText', data: 's' })
    expect(input()).toHaveValue('sqrt()')
    fireEvent.input(input(), { target: { value: 'sqrt(s)' }, inputType: 'insertReplacementText', data: 's' })
    expect(input()).toHaveValue('sqrt()')
  })

  it('validates virtual-keyboard beforeinput and non-cancelable input fallbacks', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), '2')
    fireEvent(input(), new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: '^' }))
    expect(input()).toHaveValue('2^()')
    fireEvent.input(input(), { target: { value: '2^(+)' }, inputType: 'insertText', data: '+', isComposing: true })
    expect(input()).toHaveValue('2^()')
    fireEvent.input(input(), { target: { value: '2^(3)' }, inputType: 'insertText', data: '3' })
    expect(input()).toHaveValue('2^(3)')
    fireEvent.input(input(), { target: { value: '2^(3)a' }, inputType: 'insertReplacementText', data: 'a' })
    expect(input()).toHaveValue('2^(3)')
  })

  it('keeps keyboard, paste, and browser input disabled while a request is pending', async () => {
    let resolve!: (value: { ok: boolean; json: () => Promise<{ result: number }> }) => void
    fetchMock.mockReturnValue(new Promise(done => { resolve = done }))
    const user = userEvent.setup()
    render(<App />)
    await user.type(input(), '1=')
    expect(input()).toBeDisabled()
    fireEvent.keyDown(input(), { key: '9' })
    fireEvent.paste(input(), { clipboardData: { getData: () => '2' } })
    fireEvent.input(input(), { target: { value: '12' }, inputType: 'insertText', data: '2' })
    expect(input()).toHaveValue('1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolve({ ok: true, json: async () => ({ result: 1 }) })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1'))
  })
})
