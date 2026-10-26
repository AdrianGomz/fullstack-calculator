export class CalculationError extends Error {
  constructor(message: string, public readonly position?: number) {
    super(message)
    this.name = 'CalculationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Only the backend evaluates expressions. Preserve the original input so its
// code-point error offsets continue to match what the user entered.
export async function calculate(expression: string): Promise<number> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch('/api/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression }),
      signal: controller.signal,
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      if (controller.signal.aborted) throw new Error('Request timed out')
      throw new CalculationError(!response.ok
        ? 'The calculator is unavailable right now. Please try again.'
        : 'The calculator returned an unreadable response. Please try again.')
    }
    if (!response.ok) {
      if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string' && body.error.message.trim()) {
        const position = body.error.position
        const validPosition = typeof position === 'number' && Number.isInteger(position) && position >= 0 && position <= [...expression].length
        throw new CalculationError(body.error.message, validPosition ? position : undefined)
      }
      throw new CalculationError('The calculator could not complete this request. Please try again.')
    }
    if (!isRecord(body) || typeof body.result !== 'number' || !Number.isFinite(body.result)) {
      throw new CalculationError('The calculator returned an invalid result. Please try again.')
    }
    return body.result
  } catch (error) {
    if (error instanceof CalculationError) throw error
    throw new CalculationError(controller.signal.aborted
      ? 'The calculation took too long. Please try again.'
      : 'Cannot reach the calculator. Check that the backend is running, then try again.')
  } finally {
    clearTimeout(timer)
  }
}
