package calculator

import (
	"errors"
	"math"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestEvaluate(t *testing.T) {
	cases := []struct {
		input string
		want  float64
	}{
		{"2+3+5/4", 6.25}, {"(2+3+5)/4", 2.5}, {"2*(3+(4/2))", 10},
		{"8/4*2", 4}, {"10-3-2", 5}, {"8/2/2", 2}, {"-(2+3)*4", -20},
		{"2*-3", -6}, {"2--3", 5}, {"--2", 2}, {"+-+2", -2}, {"+2", 2},
		{" .5 + 5. ", 5.5}, {"001.25*4", 5}, {"\t2\n+\r3 ", 5},
		{"2^3", 8}, {"2^3^2", 512}, {"(2^3)^2", 64}, {"-2^2", -4},
		{"(-2)^2", 4}, {"(-2)^3", -8}, {"2^-3", .125}, {"2^-2^2", .0625},
		{"2^--3", 8}, {"0^2", 0}, {"2^0", 1}, {"9^.5", 3}, {"2^-1075", 0},
		{"sqrt(4+5)", 3}, {"sqrt(sqrt(16))", 2}, {"sqrt ( 9 )", 3},
		{"sqrt(0)", 0}, {"sqrt(-0)", 0}, {"sqrt(9)^2", 9}, {"-sqrt(9)", -3},
		{"25%", .25}, {"200*10%", 20}, {"200+10%", 200.1}, {"200*(1+10%)", 220},
		{"(2^3)%", .08}, {"(10%)%", .001}, {"-25%", -.25}, {"sqrt(25%)", .5},
		{"sqrt(9)%", .03}, {"2^3%", math.Pow(2, .03)}, {"sqrt(16)+2^3+50%", 12.5},
		{"4(3)", 12}, {"(2)(4)", 8}, {"2(3+4)", 14}, {"(2)4", 8},
		{"2sqrt(9)", 6}, {"sqrt(4)2", 4}, {"sqrt(9)sqrt(4)", 6},
		{"sqrt(9)(2)", 6}, {"sqrt(2(8))", 4}, {"(2)sqrt(9)", 6},
		{"50%2", 1}, {"50%(2)", 1}, {"50%sqrt(4)", 1}, {"50%2%", .01},
		{"6/2(1+2)", 9}, {"2(3)/4", 1.5}, {"2*3(4)/2", 12},
		{"2(3)^2", 18}, {"2^3(4)", 32}, {"2^3^2(4)", 2048},
		{"-2(3)", -6}, {"2(-3)", -6}, {"2-3(4)", -10}, {"2+3(4)", 14},
		{"2^-(3)(4)", .5}, {"0(-3)", 0}, {".5(4)", 2}, {"5.(2)", 10}, {"(2).5", 1},
		{" 4 (3) ", 12}, {"(2)\t4", 8}, {"2\nsqrt(9)", 6},
		{strings.Repeat("(1)", 85) + "1", 1}, // 256 characters, shallow groups.
		{"2" + strings.Repeat("(", 32) + "3" + strings.Repeat(")", 32), 6},
		{strings.Repeat("1^", 127) + "1", 1},
		{strings.Repeat("(", 32) + strings.Repeat("1^", 95) + "1" + strings.Repeat(")", 32), 1},
		{strings.Repeat("sqrt(", 32) + "1" + strings.Repeat(")", 32), 1},
		{"0", 0}, {"-0", 0}, {"-0*4", 0}, {"0.1+0.2", .3}, {"1/.00001", 100000},
		{strings.Repeat("(", 32) + "1" + strings.Repeat(")", 32), 1},
		{strings.Repeat("-", 255) + "1", -1},
		{"1" + strings.Repeat(" ", 255), 1},
		{strings.Repeat("(1)+", 50) + "1", 51},
		{strings.Repeat("1+", 127) + "1", 128},
	}
	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			got, err := Evaluate(tc.input)
			if err != nil {
				t.Fatal(err)
			}
			if math.Abs(got-tc.want) > 1e-12*math.Max(1, math.Abs(tc.want)) {
				t.Fatalf("got %v; want %v", got, tc.want)
			}
			if got == 0 && math.Signbit(got) {
				t.Fatal("negative zero was not normalized")
			}
		})
	}
}

func TestEvaluateErrors(t *testing.T) {
	cases := []struct {
		input, code string
		position    int
	}{
		{"sqrt(-1)", InvalidArgument, 0}, {"(-2)^0.5", InvalidArgument, 4},
		{"0^0", InvalidArgument, 1}, {"0^-1", InvalidArgument, 1}, {"0^-0", InvalidArgument, 1},
		{"(-0)^-2", InvalidArgument, 4}, {"2^1024", NonFiniteResult, 1},
		{"(-2)^1024", NonFiniteResult, 4}, {"(2^1024)%", NonFiniteResult, 2},
		{"sqrt(-1)+", InvalidExpression, 9}, {"sqrt(1/0)", DivisionByZero, 6},
		{"2^sqrt(-1)", InvalidArgument, 2}, {"sqrt(-1)^0", InvalidArgument, 0},
		{"sqrt()", InvalidExpression, 5}, {"sqrt 9", InvalidExpression, 5},
		{"sqrt", InvalidExpression, 4}, {"sqrt(4", InvalidExpression, 6},
		{"sqrt(4,9)", InvalidExpression, 6},
		{"SQRT(9)", InvalidExpression, 0}, {"sqrt2(9)", InvalidExpression, 0},
		{"sqrt_x(9)", InvalidExpression, 0}, {"√9", InvalidExpression, 0},
		{"10%%", InvalidExpression, 3}, {"%10", InvalidExpression, 0},
		{"2^", InvalidExpression, 2}, {"2^^3", InvalidExpression, 2}, {"2^3^", InvalidExpression, 4},
		{strings.Repeat("sqrt(", 33) + "1" + strings.Repeat(")", 33), ExpressionTooDeep, 164},
		{strings.Repeat("(", 16) + strings.Repeat("sqrt(", 17) + "1" + strings.Repeat(")", 33), ExpressionTooDeep, 100},
		{"", InvalidExpression, 0}, {"  ", InvalidExpression, 2}, {"()", InvalidExpression, 1},
		{"(2+3", InvalidExpression, 4}, {"2+3)", InvalidExpression, 3},
		{"2+", InvalidExpression, 2}, {"2**3", InvalidExpression, 2},
		{"4()", InvalidExpression, 2}, {"(2)(", InvalidExpression, 4},
		{"2sqrt()", InvalidExpression, 6}, {"2sqrt 9", InvalidExpression, 6},
		{"2sqrt2(9)", InvalidExpression, 1}, {"s(9)", InvalidExpression, 0},
		{"(2)3 4", InvalidExpression, 5}, {"2(3) .", InvalidExpression, 5},
		{"2(3)..4", InvalidExpression, 4}, {"2sqrt(-1)+", InvalidExpression, 10},
		{"2(1/0)+", InvalidExpression, 7}, {"sqrt(-1)(", InvalidExpression, 9},
		{"0(1/0)", DivisionByZero, 3}, {"(1/0)(2)", DivisionByZero, 2},
		{"2sqrt(-1)", InvalidArgument, 1}, {"2^1023(2)", NonFiniteResult, 6},
		{"2" + strings.Repeat("(", 33) + "1" + strings.Repeat(")", 33), ExpressionTooDeep, 33},
		{"1 2", InvalidExpression, 2}, {"1 .5", InvalidExpression, 2}, {"1/0+", InvalidExpression, 4},
		{".", InvalidExpression, 0}, {"1..2", InvalidExpression, 2}, {"12abc", InvalidExpression, 2},
		{"1e3", InvalidExpression, 1},
		{"2,5", InvalidExpression, 1}, {"NaN", InvalidExpression, 0},
		{"1+💡", InvalidExpression, 2}, {"１+2", InvalidExpression, 0}, {"2\u00a0+3", InvalidExpression, 1},
		{"1\x00+2", InvalidExpression, 1}, {"---", InvalidExpression, 3}, {"*2", InvalidExpression, 0},
		{"10/(3-3)", DivisionByZero, 2}, {"1/-0", DivisionByZero, 1},
		{"-(1/0)", DivisionByZero, 3}, {"(1/0)+(2/0)", DivisionByZero, 2},
		{"1+(2/0)", DivisionByZero, 4},
		{strings.Repeat("1", 257), ExpressionTooLong, 256},
		{strings.Repeat("💡", 257), ExpressionTooLong, 256},
		{strings.Repeat("(", 33) + "1" + strings.Repeat(")", 33), ExpressionTooDeep, 32},
	}
	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			_, err := Evaluate(tc.input)
			assertError(t, err, tc.code, tc.position)
		})
	}
}

func assertError(t *testing.T, err error, code string, position int) {
	t.Helper()
	var detail *Error
	if !errors.As(err, &detail) {
		t.Fatalf("expected calculator error; got %v", err)
	}
	if detail.Code != code || detail.Position != position || detail.Error() == "" {
		t.Fatalf("got %+v; want %s at %d", detail, code, position)
	}
}

func TestNumericRangeGuards(t *testing.T) {
	// These defensive paths can be tested independently of public length limits.
	n := &numberNode{token: token{text: strings.Repeat("9", 400), position: 7}}
	assertError(t, n.convert(), NumberOutOfRange, 7)
	left := &numberNode{value: math.MaxFloat64}
	for _, operator := range []rune{'+', '*', '/'} {
		right := &numberNode{value: math.MaxFloat64}
		if operator == '/' {
			right.value = math.SmallestNonzeroFloat64
		}
		node := &binaryNode{operator: token{kind: operator, position: 8}, left: left, right: right}
		_, err := node.evaluate()
		assertError(t, err, NonFiniteResult, 8)
	}
	// Underflow is a finite zero, as specified in the contract.
	node := &binaryNode{operator: token{kind: '/'}, left: &numberNode{value: math.SmallestNonzeroFloat64}, right: &numberNode{value: 2}}
	if result, err := node.evaluate(); err != nil || result != 0 {
		t.Fatalf("underflow: %v, %v", result, err)
	}
}

func FuzzEvaluate(f *testing.F) {
	for _, input := range []string{"2+3*4", "(2+3)/4", "2^3^2", "sqrt(-1)", "sqrt(4)+25%", "10%%", "0^-1", "-2^2", "2^1024", "1/0+", "--2", "💡", "", strings.Repeat("(", 33), "4(3)", "(2)(4)", "2sqrt(9)", "50%(2)", "6/2(1+2)", "2^1023(2)", "1 2", "2sqrt(-1)+"} {
		f.Add(input)
	}
	f.Fuzz(func(t *testing.T, input string) {
		result, err := Evaluate(input)
		if err == nil {
			if math.IsNaN(result) || math.IsInf(result, 0) {
				t.Fatalf("non-finite result: %v", result)
			}
			return
		}
		var detail *Error
		if !errors.As(err, &detail) {
			t.Fatalf("unstructured error: %v", err)
		}
		if detail.Position < 0 || detail.Position > utf8.RuneCountInString(input) {
			t.Fatalf("invalid position: %+v", detail)
		}
	})
}
