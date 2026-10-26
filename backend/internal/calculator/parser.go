package calculator

type parser struct {
	tokens  []token
	index   int
	depth   int
	numbers []*numberNode
}

func (p *parser) current() token { return p.tokens[p.index] }

func (p *parser) parse() (node, error) {
	root, err := p.parseExpression()
	if err != nil {
		return nil, err
	}
	if p.current().kind != tokenEnd {
		return nil, expressionError(InvalidExpression, "Unexpected token; expected an operator or end of expression.", p.current().position)
	}
	return root, nil
}

func (p *parser) parseExpression() (node, error) {
	left, err := p.parseTerm()
	if err != nil {
		return nil, err
	}
	for p.current().kind == '+' || p.current().kind == '-' {
		operator := p.current()
		p.index++
		right, err := p.parseTerm()
		if err != nil {
			return nil, err
		}
		left = &binaryNode{operator: operator, left: left, right: right}
	}
	return left, nil
}

func (p *parser) parseTerm() (node, error) {
	left, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	for p.current().kind == '*' || p.current().kind == '/' {
		operator := p.current()
		p.index++
		right, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		left = &binaryNode{operator: operator, left: left, right: right}
	}
	return left, nil
}

func (p *parser) parseUnary() (node, error) {
	start := p.index
	for p.current().kind == '+' || p.current().kind == '-' {
		p.index++
	}
	end := p.index
	operand, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	for i := end - 1; i >= start; i-- {
		operand = &unaryNode{operator: p.tokens[i], operand: operand}
	}
	return operand, nil
}

func (p *parser) parsePrimary() (node, error) {
	current := p.current()
	switch current.kind {
	case tokenNumber:
		p.index++
		number := &numberNode{token: current}
		p.numbers = append(p.numbers, number)
		return number, nil
	case '(':
		if p.depth == MaxParenthesisDepth {
			return nil, expressionError(ExpressionTooDeep, "Parentheses exceed the maximum nesting depth of 32.", current.position)
		}
		p.index++
		p.depth++
		expression, err := p.parseExpression()
		p.depth--
		if err != nil {
			return nil, err
		}
		if p.current().kind != ')' {
			return nil, expressionError(InvalidExpression, "Expected a closing ')'.", p.current().position)
		}
		p.index++
		return expression, nil
	default:
		return nil, expressionError(InvalidExpression, "Expected a number or '('.", current.position)
	}
}
