package calculator

const (
	tokenEnd    rune = 0
	tokenNumber rune = 'n'
)

type token struct {
	kind     rune
	text     string
	position int
}

func tokenize(expression string) ([]token, error) {
	input := []rune(expression)
	tokens := make([]token, 0, len(input)+1)
	for i := 0; i < len(input); {
		current := input[i]
		switch current {
		case ' ', '\t', '\r', '\n':
			i++
		case '+', '-', '*', '/', '(', ')':
			tokens = append(tokens, token{kind: current, position: i})
			i++
		default:
			start := i
			if !isDigit(current) && current != '.' {
				return nil, expressionError(InvalidExpression, "Unsupported character in expression.", i)
			}
			digits := 0
			for i < len(input) && isDigit(input[i]) {
				i++
				digits++
			}
			if i < len(input) && input[i] == '.' {
				i++
				for i < len(input) && isDigit(input[i]) {
					i++
					digits++
				}
			}
			if digits == 0 {
				return nil, expressionError(InvalidExpression, "Expected a number.", start)
			}
			tokens = append(tokens, token{kind: tokenNumber, text: string(input[start:i]), position: start})
		}
	}
	return append(tokens, token{kind: tokenEnd, position: len(input)}), nil
}

func isDigit(character rune) bool { return character >= '0' && character <= '9' }
