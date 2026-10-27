import styles from './Keypad.module.css'

interface KeyDefinition {
  value: string
  label: string
  symbol: string
  variant?: 'operator' | 'utility' | 'equals'
}

const keys: readonly KeyDefinition[] = [
  { value: '(', label: 'Open parenthesis', symbol: '(', variant: 'utility' },
  { value: ')', label: 'Close parenthesis', symbol: ')', variant: 'utility' },
  { value: 'Clear', label: 'Clear', symbol: 'Clear', variant: 'utility' },
  { value: 'Backspace', label: 'Backspace', symbol: '⌫', variant: 'utility' },

  { value: '^', label: 'Power', symbol: 'xʸ', variant: 'operator' },
  { value: 'sqrt', label: 'Square root', symbol: '√', variant: 'operator' },
  { value: '%', label: 'Percentage', symbol: '%', variant: 'operator' },
  { value: '/', label: 'Divide', symbol: '÷', variant: 'operator' },

  { value: '7', label: '7', symbol: '7' },
  { value: '8', label: '8', symbol: '8' },
  { value: '9', label: '9', symbol: '9' },
  { value: '*', label: 'Multiply', symbol: '×', variant: 'operator' },

  { value: '4', label: '4', symbol: '4' },
  { value: '5', label: '5', symbol: '5' },
  { value: '6', label: '6', symbol: '6' },
  { value: '+', label: 'Add', symbol: '+', variant: 'operator' },

  { value: '1', label: '1', symbol: '1' },
  { value: '2', label: '2', symbol: '2' },
  { value: '3', label: '3', symbol: '3' },
  { value: '-', label: 'Subtract', symbol: '−', variant: 'operator' },

  { value: '0', label: '0', symbol: '0' },
  { value: '.', label: '.', symbol: '.' },
  { value: '=', label: 'Calculate', symbol: '=', variant: 'equals' },
]

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
          key={key.value}
          type={key.value === '=' ? 'submit' : 'button'}
          aria-label={key.label}
          className={`${styles.key}${key.variant ? ` ${styles[key.variant]}` : ''}`}
          onClick={key.value === '=' ? undefined : () => onKeyPress(key.value)}
        >
          {key.symbol}
        </button>
      ))}
    </fieldset>
  )
}
