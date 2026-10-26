import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculate, CalculationError } from './calculator'

const reply = (body: unknown, ok = true) => ({ ok, json: async () => body })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('calculator API client', () => {
  it('sends the original expression and returns a finite result, including zero', async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ result: 0 }))
    vi.stubGlobal('fetch', fetch)
    expect(await calculate(' 1-1 ')).toBe(0)
    expect(fetch).toHaveBeenCalledWith('/api/v1/calculate', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"expression":" 1-1 "}',
    }))
  })
  it('preserves server messages and valid positions, including zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ error: { message: 'Invalid character.', position: 0 } }, false)))
    await expect(calculate('x')).rejects.toMatchObject({ message: 'Invalid character.', position: 0 })
  })
  it.each([-1, 100, 1.5, '0', null])('discards invalid server position %s', async position => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ error: { message: 'Invalid.', position } }, false)))
    await expect(calculate('x')).rejects.toMatchObject({ message: 'Invalid.', position: undefined })
  })
  it.each([null, {}, { result: '2' }, { result: Infinity }, { result: NaN }])('rejects malformed successful data %s', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(body)))
    await expect(calculate('1+1')).rejects.toThrow('invalid result')
  })
  it('handles an error response without the expected shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ error: 'failure' }, false)))
    await expect(calculate('1')).rejects.toThrow('could not complete')
  })
  it('handles non-JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('HTML') } }))
    await expect(calculate('1')).rejects.toThrow('unreadable response')
  })
  it('handles a proxy error without JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new SyntaxError('HTML') } }))
    await expect(calculate('1')).rejects.toThrow('unavailable right now')
  })
  it('handles an unreachable backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')))
    await expect(calculate('1')).rejects.toThrow('Cannot reach the calculator')
  })
  it('aborts a request after ten seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const request = expect(calculate('1')).rejects.toThrow('took too long')
    await vi.advanceTimersByTimeAsync(10_000)
    await request
  })
  it('handles a timeout while reading the response body', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, options) => Promise.resolve({ ok: true, json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }) })))
    const request = expect(calculate('1')).rejects.toBeInstanceOf(CalculationError)
    await vi.advanceTimersByTimeAsync(10_000)
    await request
  })
})
