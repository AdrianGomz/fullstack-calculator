const keys = ['(', ')', 'Clear', 'Backspace', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '+', '=']
const labels: Record<string, string> = {
  '/': 'Divide', '*': 'Multiply', '-': 'Subtract', '+': 'Add',
  '=': 'Calculate', '(': 'Open parenthesis', ')': 'Close parenthesis',
}
const symbols: Record<string, string> = { '/': '÷', '*': '×', '-': '−', Backspace: '⌫' }

interface KeypadProps {
  pending: boolean
  onKeyPress: (key: string) => void
}

export default function Keypad({ pending, onKeyPress }: KeypadProps) {
  return (
    <fieldset className="keypad" disabled={pending}>
      <legend className="sr-only">Calculator keypad</legend>
      {keys.map(key => (
        <button
          key={key}
          type={key === '=' ? 'submit' : 'button'}
          aria-label={labels[key] ?? key}
          className={`key ${key === '=' ? 'equals' : ['/', '*', '-', '+'].includes(key) ? 'operator' : ['(', ')', 'Clear', 'Backspace'].includes(key) ? 'utility' : ''}`}
          onClick={key === '=' ? undefined : () => onKeyPress(key)}
        >
          {symbols[key] ?? key}
        </button>
      ))}
    </fieldset>
  )
}
