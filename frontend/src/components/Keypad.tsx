import styles from './Keypad.module.css'

const keys = [
  '(', ')', 'Clear', 'Backspace',
  '^', 'sqrt', '%', '/',
  '7', '8', '9', '*',
  '4', '5', '6', '+',
  '1', '2', '3', '-',
  '0', '.', '=',
]
const labels: Record<string, string> = {
  '/': 'Divide', '*': 'Multiply', '-': 'Subtract', '+': 'Add',
  '=': 'Calculate', '(': 'Open parenthesis', ')': 'Close parenthesis',
  '^': 'Power', sqrt: 'Square root', '%': 'Percentage',
}
const symbols: Record<string, string> = { '/': '÷', '*': '×', '-': '−', '^': 'xʸ', sqrt: '√', Backspace: '⌫' }

interface KeypadProps {
  pending: boolean
  onKeyPress: (key: string) => void
}

export default function Keypad({ pending, onKeyPress }: KeypadProps) {
  return (
    <fieldset className={styles.keypad} disabled={pending}>
      <legend className="sr-only">Calculator keypad</legend>
      {keys.map(key => (
        <button
          key={key}
          type={key === '=' ? 'submit' : 'button'}
          aria-label={labels[key] ?? key}
          className={`${styles.key} ${key === '=' ? styles.equals : ['/', '*', '-', '+', '^', 'sqrt', '%'].includes(key) ? styles.operator : ['(', ')', 'Clear', 'Backspace'].includes(key) ? styles.utility : ''}`}
          onClick={key === '=' ? undefined : () => onKeyPress(key)}
        >
          {symbols[key] ?? key}
        </button>
      ))}
    </fieldset>
  )
}
