package calculator

const (
	tokenEnd    rune = 0
	tokenNumber rune = 'n'
	tokenSqrt   rune = 's'
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
			continue
		case '+', '-', '*', '/', '^', '%', '(', ')':
			tokens = append(tokens, token{kind: current, position: i})
			i++
			continue
		}

		var scanned token
		var err error
		switch {
		case isLetter(current):
			scanned, i, err = scanIdentifier(input, i)
		case isDigit(current) || current == '.':
			scanned, i, err = scanNumber(input, i)
		default:
			return nil, expressionError(InvalidExpression, "Unsupported character in expression.", i)
		}
		if err != nil {
			return nil, err
		}
		tokens = append(tokens, scanned)
	}
	return append(tokens, token{kind: tokenEnd, position: len(input)}), nil
}

// Scanners return the token and the index of the first unconsumed code point.
func scanIdentifier(input []rune, start int) (token, int, error) {
	end := start
	for end < len(input) && (isLetter(input[end]) || isDigit(input[end]) || input[end] == '_') {
		end++
	}
	name := string(input[start:end])
	if name != "sqrt" {
		return token{}, end, expressionError(InvalidExpression, "Unsupported name in expression.", start)
	}
	return token{kind: tokenSqrt, text: name, position: start}, end, nil
}

func scanNumber(input []rune, start int) (token, int, error) {
	end := start
	digits := 0
	for end < len(input) && isDigit(input[end]) {
		end++
		digits++
	}
	if end < len(input) && input[end] == '.' {
		end++
		for end < len(input) && isDigit(input[end]) {
			end++
			digits++
		}
	}
	if digits == 0 {
		return token{}, end, expressionError(InvalidExpression, "Expected a number.", start)
	}
	return token{kind: tokenNumber, text: string(input[start:end]), position: start}, end, nil
}

func isDigit(character rune) bool { return character >= '0' && character <= '9' }

func isLetter(character rune) bool {
	return character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z'
}
