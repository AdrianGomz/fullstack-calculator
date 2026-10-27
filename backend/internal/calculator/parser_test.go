package calculator

import (
	"reflect"
	"testing"
)

func TestTokenize(t *testing.T) {
	got, err := tokenize(" 12.5 + (.5)\n")
	if err != nil {
		t.Fatal(err)
	}
	want := []token{
		{kind: tokenNumber, text: "12.5", position: 1}, {kind: '+', position: 6},
		{kind: '(', position: 8}, {kind: tokenNumber, text: ".5", position: 9},
		{kind: ')', position: 11}, {kind: tokenEnd, position: 13},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("tokens = %#v; want %#v", got, want)
	}
}

func TestParserTree(t *testing.T) {
	for _, tc := range []struct {
		input       string
		root, child rune
		childOnLeft bool
	}{
		{"2+3*4", '+', '*', false},
		{"(2+3)*4", '*', '+', true},
		{"10-3-2", '-', '-', true},
		{"2^3^2", '^', '^', false},
		{"(2^3)^2", '^', '^', true},
		{"4(3+2)", '*', '+', false},
		{"6/2(1+2)", '*', '/', true},
		{"2(3)^2", '*', '^', false},
		{"2^3(4)", '*', '^', true},
		{"4(3)(2)", '*', '*', true},
		{"50%(2)^3", '*', '^', false},
	} {
		t.Run(tc.input, func(t *testing.T) {
			tokens, err := tokenize(tc.input)
			if err != nil {
				t.Fatal(err)
			}
			p := parser{tokens: tokens}
			tree, err := p.parse()
			if err != nil {
				t.Fatal(err)
			}
			root, ok := tree.(*binaryNode)
			if !ok || root.operator.kind != tc.root {
				t.Fatalf("unexpected root: %#v", tree)
			}
			child := root.right
			if tc.childOnLeft {
				child = root.left
			}
			binary, ok := child.(*binaryNode)
			if !ok || binary.operator.kind != tc.child {
				t.Fatalf("unexpected child: %#v", child)
			}
		})
	}
}

func TestImplicitMultiplicationPositions(t *testing.T) {
	for _, tc := range []struct {
		input    string
		position int
	}{
		{"4(3)", 1}, {"2 sqrt(9)", 2}, {"(2)4", 3},
		{"25%(2)", 3}, {"  4 (3)", 4}, {"2^3(4)", 3},
	} {
		t.Run(tc.input, func(t *testing.T) {
			tokens, err := tokenize(tc.input)
			if err != nil {
				t.Fatal(err)
			}
			original := append([]token(nil), tokens...)
			p := parser{tokens: tokens}
			tree, err := p.parse()
			if err != nil {
				t.Fatal(err)
			}
			root, ok := tree.(*binaryNode)
			if !ok || root.operator.kind != '*' || root.operator.position != tc.position {
				t.Fatalf("unexpected multiplication tree: %#v", tree)
			}
			if !reflect.DeepEqual(tokens, original) {
				t.Fatal("parsing modified the original tokens")
			}
		})
	}
}

func TestImplicitMultiplicationBoundaries(t *testing.T) {
	for _, tc := range []struct {
		previous, next rune
		want           bool
	}{
		{tokenNumber, '(', true}, {tokenNumber, tokenSqrt, true},
		{')', tokenNumber, true}, {')', '(', true}, {')', tokenSqrt, true},
		{'%', tokenNumber, true}, {'%', '(', true}, {'%', tokenSqrt, true},
		{tokenNumber, tokenNumber, false}, {tokenNumber, '+', false}, {tokenNumber, '-', false},
		{')', '+', false}, {')', '-', false}, {'%', '%', false},
		{'(', tokenNumber, false}, {tokenSqrt, '(', false}, {tokenNumber, tokenEnd, false},
	} {
		if got := allowsImplicitMultiplication(tc.previous, tc.next); got != tc.want {
			t.Errorf("implicit %q followed by %q = %v; want %v", tc.previous, tc.next, got, tc.want)
		}
	}
}

func TestTokenizeOptionalOperations(t *testing.T) {
	got, err := tokenize("sqrt(9)^2%")
	if err != nil {
		t.Fatal(err)
	}
	want := []token{
		{kind: tokenSqrt, text: "sqrt", position: 0}, {kind: '(', position: 4},
		{kind: tokenNumber, text: "9", position: 5}, {kind: ')', position: 6},
		{kind: '^', position: 7}, {kind: tokenNumber, text: "2", position: 8},
		{kind: '%', position: 9}, {kind: tokenEnd, position: 10},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("tokens=%#v; want %#v", got, want)
	}
}

func TestPowerAndUnaryTree(t *testing.T) {
	tokens, err := tokenize("-2^2%")
	if err != nil {
		t.Fatal(err)
	}
	p := parser{tokens: tokens}
	tree, err := p.parse()
	if err != nil {
		t.Fatal(err)
	}
	sign, ok := tree.(*unaryNode)
	if !ok || sign.operator.kind != '-' {
		t.Fatalf("expected leading minus: %#v", tree)
	}
	power, ok := sign.operand.(*binaryNode)
	if !ok || power.operator.kind != '^' {
		t.Fatalf("expected power: %#v", sign.operand)
	}
	percent, ok := power.right.(*unaryNode)
	if !ok || percent.operator.kind != '%' {
		t.Fatalf("expected percentage: %#v", power.right)
	}
}
