// Package calculator parses and evaluates a bounded arithmetic expression.
// It has no dependency on HTTP or other application layers.
package calculator

import (
	"math"
	"strconv"
	"unicode/utf8"
)

const (
	MaxExpressionLength = 256
	MaxParenthesisDepth = 32
	InvalidExpression   = "INVALID_EXPRESSION"
	ExpressionTooLong   = "EXPRESSION_TOO_LONG"
	ExpressionTooDeep   = "EXPRESSION_TOO_DEEP"
	NumberOutOfRange    = "NUMBER_OUT_OF_RANGE"
	DivisionByZero      = "DIVISION_BY_ZERO"
	NonFiniteResult     = "NON_FINITE_RESULT"
)

// Error identifies a problem at a zero-based code-point offset in the input.
// Position can equal the input length when a token is missing at the end.
type Error struct {
	Code     string
	Message  string
	Position int
}

func (e *Error) Error() string { return e.Message }

func expressionError(code, message string, position int) *Error {
	return &Error{Code: code, Message: message, Position: position}
}

// Evaluate validates the entire expression before performing arithmetic.
// It supports +, -, *, /, unary signs, decimal numbers, and parentheses.
func Evaluate(expression string) (float64, error) {
	if utf8.RuneCountInString(expression) > MaxExpressionLength {
		return 0, expressionError(ExpressionTooLong, "Expression exceeds 256 characters.", MaxExpressionLength)
	}
	tokens, err := tokenize(expression)
	if err != nil {
		return 0, err
	}
	p := parser{tokens: tokens}
	root, err := p.parse()
	if err != nil {
		return 0, err
	}
	// Convert literals only after the complete syntax is valid, in source order.
	for _, number := range p.numbers {
		if err := number.convert(); err != nil {
			return 0, err
		}
	}
	result, err := root.evaluate()
	if err != nil {
		return 0, err
	}
	// Normalize negative zero.
	if result == 0 {
		return 0, nil
	}
	return result, nil
}

type node interface{ evaluate() (float64, error) }

type numberNode struct {
	token token
	value float64
}

func (n *numberNode) convert() error {
	value, err := strconv.ParseFloat(n.token.text, 64)
	if err != nil || math.IsInf(value, 0) || math.IsNaN(value) {
		return expressionError(NumberOutOfRange, "Number is outside the supported range.", n.token.position)
	}
	n.value = value
	return nil
}
func (n *numberNode) evaluate() (float64, error) { return n.value, nil }

type unaryNode struct {
	operator token
	operand  node
}

func (n *unaryNode) evaluate() (float64, error) {
	value, err := n.operand.evaluate()
	if err != nil {
		return 0, err
	}
	if n.operator.kind == '-' {
		value = -value
	}
	return value, nil
}

type binaryNode struct {
	operator    token
	left, right node
}

func (n *binaryNode) evaluate() (float64, error) {
	left, err := n.left.evaluate()
	if err != nil {
		return 0, err
	}
	right, err := n.right.evaluate()
	if err != nil {
		return 0, err
	}
	var result float64
	switch n.operator.kind {
	case '+':
		result = left + right
	case '-':
		result = left - right
	case '*':
		result = left * right
	case '/':
		if right == 0 {
			return 0, expressionError(DivisionByZero, "Cannot divide by zero.", n.operator.position)
		}
		result = left / right
	}
	if math.IsInf(result, 0) || math.IsNaN(result) {
		return 0, expressionError(NonFiniteResult, "Calculation exceeds the supported numeric range.", n.operator.position)
	}
	return result, nil
}
