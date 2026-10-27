# Calculator implementation

The HTTP layer calls `calculator.Evaluate(expression) (float64, error)`. The calculator package has no HTTP dependencies and can be tested without running a server.

## Processing stages

1. **Tokenize** (`backend/internal/calculator/tokenizer.go`): recognize numbers, operators (including `^` and `%`), the exact name `sqrt`, parentheses, and permitted whitespace. Each token stores its original code-point position. Unsupported characters are rejected.
2. **Parse** (`backend/internal/calculator/parser.go`): recursive-descent functions build an expression tree. `parseExpression` handles addition/subtraction, `parseTerm` multiplication/division, `parseUnary` signs, `parsePower` right-associative exponentiation, `parsePostfix` percentage, and `parsePrimary` numbers/parentheses/square-root calls. Loops build equal-precedence binary operators from left to right. Parentheses and square-root arguments recurse into `parseExpression`, sharing the 32-level limit. A power exponent recurses into `parseUnary`, permitting `2^-3` while interpreting `-2^2` as `-(2^2)`.
3. **Convert and evaluate** (`backend/internal/calculator/calculator.go`): after complete syntax validation, convert number literals in source order, then evaluate the tree. Binary nodes evaluate their left and right children before applying an operator. Unary nodes implement signs, percentage (`x/100`), and square root. Binary nodes also implement power using `math.Pow`. Division rejects zero; square root and powers validate their real-number domains; arithmetic rejects non-finite results. Normalize a final negative zero to zero.

The tree for `2+3*4` has addition at its root and multiplication as its right child. The tree for `(2+3)*4` has multiplication at its root and addition as its left child. The evaluator follows this structure, so it does not need its own precedence rules.

## Design patterns

This is a small application of the **Interpreter pattern**: the program interprets a deliberately restricted arithmetic language. The tree has a **Composite structure**: unary and binary expressions contain other expressions behind the private `node` interface. Number, unary, and binary nodes implement `evaluate()`.

Recursive descent is the parsing algorithm. Three private node types are sufficient; no visitor framework or operator registry is needed for the supported operations.

## Validation and error boundaries

The HTTP handler checks method, Content-Type, body size, and the exact JSON schema. Explicit token decoding rejects duplicate keys and case variants that ordinary struct unmarshalling would otherwise accept. It then calls the calculator and maps syntax/limit errors to `400`, arithmetic/range errors to `422`, and returns successful finite results as JSON.

The calculator validates expression length, tokenizes, parses the entire input, converts literals, and evaluates. Parsing first ensures `1/0+` returns a syntax error instead of a division error. Tokens/nodes retain positions, allowing errors to point into the original expression, including whitespace. A position of zero is preserved in JSON by using a pointer rather than an omitted zero-valued integer.

Limits are 4096 body bytes, 256 expression code points, and 32 nested parentheses. These bound allocation, parser recursion, and tree evaluation. Left-associative binary chains and unary signs are parsed using loops. Power chains recurse to the right and remain bounded by the expression length; tests exercise maximum-length chains and mixed grouping/function nesting.

## Tests

- `calculator_test.go`: observable results, associativity, error codes/positions, input boundaries, numeric guards, and a fuzz target checking finite successes and valid error offsets.
- `parser_test.go`: token positions and tree shapes for precedence, parentheses, and left associativity.
- `calculate_test.go`: HTTP request validation, results, error mapping, position serialization, and body/length/depth boundaries.
- Existing route/configuration tests continue to cover the server foundation.

No general-purpose code evaluation is used. Supported extensions are `^`, `sqrt(...)`, and postfix `%`. Scientific notation, implicit multiplication, other functions, and `**` remain unsupported. Percentage has no context-dependent base; `0^0`, zero to a negative exponent, negative square roots, and negative bases with noninteger exponents return `422 INVALID_ARGUMENT`.

## Frontend

See the [frontend implementation and review guide](FRONTEND.md) for the full state model, interaction flow, API behavior, and choices to review.

`frontend/src/App.tsx` contains the page layout and renders `Calculator`. `frontend/src/components/Calculator.tsx` owns local expression/result/error/pending state, submission, and input editing/focus. It composes `ExpressionInput`, `ResultPanel`, and `Keypad`, passing typed props and callbacks. Only presence and the 256-code-point input limit are checked locally. The original expression is sent unchanged; Go remains responsible for grammar and arithmetic.

`frontend/src/api/calculator.ts` owns fetch, JSON validation, error translation, and a ten-second abort timeout. It accepts only finite numeric successes and validates optional server positions before displaying them. React displays server text as ordinary escaped text.

The UI disables edits during a request, prevents duplicate submissions, clears stale results on edits, and returns focus to the input after success/error. Keypad actions respect the cursor/selection. The keypad forwards `^`, `sqrt`, and `%` editing actions to Calculator alongside the basic keys. It uses a single four-column grid with equals spanning two columns. The `sqrt` action creates a balanced call or wraps the selection; other keys retain literal insertion semantics. ExpressionInput links syntax/percentage help and preserves a non-wrapping character count. Server positions count code points, while native input selections use UTF-16 offsets; the UI translates between them and backspaces whole code points.

Vite proxies `/api` to Go during development. `API_PROXY_TARGET` configures an alternate backend address. Production hosting must supply an equivalent same-origin route; no API credentials or direct browser cross-origin requests are needed. Styling uses plain CSS with a centered single-column calculator, reduced padding on mobile, and reduced-motion support. `App` contains the compact Calculator wordmark and the persistent author credit; calculator-specific rendering belongs to the four components.
