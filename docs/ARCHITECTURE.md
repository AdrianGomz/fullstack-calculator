# Calculator implementation

The HTTP layer calls `calculator.Evaluate(expression) (float64, error)`. The calculator package has no HTTP dependencies and can be tested without running a server.

## Processing stages

1. **Tokenize** (`backend/internal/calculator/tokenizer.go`): recognize numbers, operators (including `^` and `%`), the exact name `sqrt`, parentheses, and permitted whitespace. Each token stores its original code-point position. Unsupported characters are rejected.
2. **Parse** (`backend/internal/calculator/parser.go`): recursive-descent functions build an expression tree. `parseExpression` handles addition/subtraction, `parseTerm` explicit/implicit multiplication and division, `parseUnary` signs, `parsePower` right-associative exponentiation, `parsePostfix` percentage, and `parsePrimary` numbers/parentheses/square-root calls. Loops build equal-precedence binary operators from left to right. Parentheses and square-root arguments recurse into `parseExpression`, sharing the 32-level limit. A power exponent recurses into `parseUnary`, permitting `2^-3` while interpreting `-2^2` as `-(2^2)`.
3. **Convert and evaluate** (`backend/internal/calculator/calculator.go`): after complete syntax validation, convert number literals in source order, then evaluate the tree. Binary nodes evaluate their left and right children before applying an operator. Unary nodes implement signs, percentage (`x/100`), and square root. Binary nodes also implement power using `math.Pow`. Division rejects zero; square root and powers validate their real-number domains; arithmetic rejects non-finite results. Normalize a final negative zero to zero.

The tree for `2+3*4` has addition at its root and multiplication as its right child. The tree for `(2+3)*4` has multiplication at its root and addition as its left child. The evaluator follows this structure, so it does not need its own precedence rules.

`allowsImplicitMultiplication` permits a number followed by `(`/`sqrt`, or `)`/`%` followed by a number, `(`, or `sqrt`. `parseTerm` synthesizes a normal `*` token at the right operand's original position and leaves that operand available to `parseUnary`. Source tokens are not modified. Thus `4(3+2)` builds the same multiplication tree as `4*(3+2)`. Implicit multiplication has the same precedence and left associativity as explicit `*` and `/`: `6/2(1+2)` is `9`. Adjacent number tokens and following signs are not implicit boundaries, preserving rejection of `1 2` and subtraction in `2-3`.

## Design patterns

This is a small application of the **Interpreter pattern**: the program interprets a deliberately restricted arithmetic language. The tree has a **Composite structure**: unary and binary expressions contain other expressions behind the private `node` interface. Number, unary, and binary nodes implement `evaluate()`.

Recursive descent is the parsing algorithm. Three private node types are sufficient; no visitor framework or operator registry is needed for the supported operations.

## Validation and error boundaries

The HTTP handler checks method, Content-Type, body size, and the exact JSON schema. Explicit token decoding rejects duplicate keys and case variants that ordinary struct unmarshalling would otherwise accept. It then calls the calculator and maps syntax/limit errors to `400`, arithmetic/range errors to `422`, and returns successful finite results as JSON.

The calculator validates expression length, tokenizes, parses the entire input, converts literals, and evaluates. Parsing first ensures `1/0+` returns a syntax error instead of a division error. Tokens/nodes retain positions, allowing errors to point into the original expression, including whitespace. A position of zero is preserved in JSON by using a pointer rather than an omitted zero-valued integer.

Limits are 4096 body bytes, 256 expression code points, and 32 nested parentheses. These bound allocation, parser recursion, and tree evaluation. Left-associative binary chains and unary signs are parsed using loops. Power chains recurse to the right and remain bounded by the expression length; tests exercise maximum-length chains and mixed grouping/function nesting.

## Tests

- `calculator_test.go`: observable results, associativity, error codes/positions, input boundaries, numeric guards, and a fuzz target checking finite successes and valid error offsets.
- `parser_test.go`: token positions, implicit-boundary rules, original-token preservation, and tree shapes for precedence, parentheses, and left associativity.
- `calculate_test.go`: HTTP request validation, results, error mapping, position serialization, and body/length/depth boundaries.
- Existing route/configuration tests continue to cover the server foundation.

No general-purpose code evaluation is used. Supported extensions are `^`, `sqrt(...)`, postfix `%`, and the documented implicit-multiplication boundaries. Scientific notation, other functions, and `**` remain unsupported. Percentage has no context-dependent base; `0^0`, zero to a negative exponent, negative square roots, and negative bases with noninteger exponents return `422 INVALID_ARGUMENT`. Arithmetic failure at an implicit multiplication points to the beginning of its right operand, such as `(` in `2^1023(2)`.

## Frontend

See the [frontend implementation and review guide](FRONTEND.md) for the full state model, interaction flow, API behavior, and choices to review.

`frontend/src/App.tsx` contains the page layout and renders `Calculator`. `frontend/src/components/Calculator.tsx` owns API feedback/pending state and submission, and uses `useExpressionEditor` for local expression/caret state. It composes `ExpressionInput`, `ResultPanel`, and `Keypad`, passing typed props and callbacks. Keyboard/keypad input uses shared character restrictions, operator/context rules, and caret handling. Presence and the 256-code-point limit are checked on submission. The displayed expression is sent unchanged; Go remains responsible for complete grammar and arithmetic.

`frontend/src/api/calculator.ts` owns fetch, JSON validation, error translation, and a ten-second abort timeout. It accepts only finite numeric successes and validates optional server positions before displaying them. React displays server text as ordinary escaped text.

The UI disables edits during a request, prevents duplicate submissions, clears stale results on edits, and returns focus to the input after success/error. Keypad actions respect the cursor/selection. The keypad and physical keys share editing actions; lowercase `s` invokes Square root. The keypad uses a single four-column grid with equals spanning two columns. Power and root actions create balanced templates or wrap selections. Existing automatic `*` insertion remains visible when typing/clicking; accepted pasted arithmetic text stays literal, allowing `4(3)` to reach the backend unchanged. Paste restrictions on letters, including function names, remain in place. ExpressionInput links syntax/error help and preserves a non-wrapping character count. Server positions count code points, while native input selections use UTF-16 offsets; the UI translates between them and deletes whole code points.

Vite proxies `/api` to Go during development. `API_PROXY_TARGET` configures an alternate backend address. Production hosting must supply an equivalent same-origin route; no API credentials or direct browser cross-origin requests are needed. Each TSX component imports a matching CSS Module for its scoped appearance and responsive rules. Global styles.css contains shared font/color variables, resets, focus/disabled behavior, the sr-only utility, and reduced-motion support. The layout remains a centered single-column calculator with reduced mobile padding. `App` contains the compact Calculator wordmark and the persistent author credit; calculator-specific rendering belongs to the four components.
