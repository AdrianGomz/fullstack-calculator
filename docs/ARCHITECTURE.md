# Calculator implementation

The HTTP layer calls `calculator.Evaluate(expression) (float64, error)`. The calculator package has no HTTP dependencies and can be tested without running a server.

## Processing stages

1. **Tokenize** (`backend/internal/calculator/tokenizer.go`): recognize numbers, operators, parentheses, and permitted whitespace. Each token stores its original code-point position. Unsupported characters are rejected.
2. **Parse** (`backend/internal/calculator/parser.go`): recursive-descent functions build an expression tree. `parseExpression` handles addition/subtraction, `parseTerm` multiplication/division, `parseUnary` signs, and `parsePrimary` numbers/parentheses. Loops build equal-precedence binary operators from left to right. Parentheses recurse into `parseExpression`, with a depth limit.
3. **Convert and evaluate** (`backend/internal/calculator/calculator.go`): after complete syntax validation, convert number literals in source order, then evaluate the tree. Binary nodes evaluate their left and right children before applying an operator. Division rejects zero, and arithmetic rejects non-finite results. Normalize a final negative zero to zero.

The tree for `2+3*4` has addition at its root and multiplication as its right child. The tree for `(2+3)*4` has multiplication at its root and addition as its left child. The evaluator follows this structure, so it does not need its own precedence rules.

## Design patterns

This is a small application of the **Interpreter pattern**: the program interprets a deliberately restricted arithmetic language. The tree has a **Composite structure**: unary and binary expressions contain other expressions behind the private `node` interface. Number, unary, and binary nodes implement `evaluate()`.

Recursive descent is the parsing algorithm. Three private node types are sufficient; no visitor framework or operator registry is needed for the supported operations.

## Validation and error boundaries

The HTTP handler checks method, Content-Type, body size, and the exact JSON schema. Explicit token decoding rejects duplicate keys and case variants that ordinary struct unmarshalling would otherwise accept. It then calls the calculator and maps syntax/limit errors to `400`, arithmetic/range errors to `422`, and returns successful finite results as JSON.

The calculator validates expression length, tokenizes, parses the entire input, converts literals, and evaluates. Parsing first ensures `1/0+` returns a syntax error instead of a division error. Tokens/nodes retain positions, allowing errors to point into the original expression, including whitespace. A position of zero is preserved in JSON by using a pointer rather than an omitted zero-valued integer.

Limits are 4096 body bytes, 256 expression code points, and 32 nested parentheses. These bound allocation, parser recursion, and tree evaluation. Binary chains and unary signs are parsed using loops.

## Tests

- `calculator_test.go`: observable results, associativity, error codes/positions, input boundaries, numeric guards, and a fuzz target checking finite successes and valid error offsets.
- `parser_test.go`: token positions and tree shapes for precedence, parentheses, and left associativity.
- `calculate_test.go`: HTTP request validation, results, error mapping, position serialization, and body/length/depth boundaries.
- Existing route/configuration tests continue to cover the server foundation.

No general-purpose code evaluation is used. Exponentiation, functions, scientific notation, implicit multiplication, and percentages require an explicit grammar extension before they can be accepted.
