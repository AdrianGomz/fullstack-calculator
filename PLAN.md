# Calculator application plan

Date: 2026-10-25  
Status: backend and React/TypeScript frontend are implemented, tested, and verified together locally. Remote publication remains pending.

## Objective and scope

Build a full-stack calculator with a React frontend that calls a Go REST microservice for arithmetic. Prioritize correctness, clear code, and testable boundaries within approximately 2–4 hours of implementation work.

The assignment requires addition, subtraction, multiplication, and division; frontend and backend validation; a responsive UI; JSON responses; unit tests for both layers; coverage reports; setup/API/design documentation; and submission of a Git repository link and prompts used.

The assignment treats exponentiation, square root, percentage, and Docker as optional. The three arithmetic operations are now implemented in the backend after completion of the required functionality. Dedicated frontend controls remain deferred; Docker is not implemented.

User-approved extension: evaluate complete expressions, including nested parentheses. `2+3+5/4` yields `6.25`; `(2+3+5)/4` yields `2.5`.

## Proposed design decisions

Expression input, standard precedence, and nested parentheses are user-approved requirements. The remaining implementation choices are proposals.

| Area | Choice | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, plain CSS | Small setup, explicit types, minimal styling dependencies. |
| Backend | Go standard library `net/http` and `encoding/json` | Enough for a small REST service without a framework. |
| API | `POST /api/v1/calculate` with an `expression` string | Multiple operations and parentheses in one calculation. |
| Calculation | Pure Go tokenizer, recursive-descent parser, and evaluator separated from HTTP handlers | Arithmetic and transport behavior can be tested independently. |
| Frontend API access | A small typed `fetch` wrapper | Centralized JSON parsing, HTTP errors, and network error handling. |
| State | Local React state | No shared global state or persistence is needed. |
| Numbers | Go `float64` / JavaScript numbers | Appropriate for a general calculator; document binary floating-point limitations. |
| Development | Vite proxies `/api` to Go on port 8080 | Browser requests use the frontend origin without separate CORS configuration. |
| Storage/authentication | Neither in the assignment scope | Calculations are stateless and require no accounts. |

Accept only the arithmetic grammar in [the API contract](docs/API.md). Parse the entire expression before evaluating it, and never use general-purpose code evaluation or shell execution. Keep calculation results on the backend; frontend validation improves usability but never replaces server validation.

## User experience

Use a labeled expression field, an equals button for calculation, a Clear button, and a visible result/error area. The implemented keypad supports numbers, operators, parentheses, decimal points, and Backspace. The input placeholder shows a parenthesized example.

- Support multiple operators, nested parentheses, unary signs, decimals, zero, and whitespace. Require complete expression parsing; never accept only the valid prefix of `12abc`.
- Validate nonempty input and a 256-character limit locally. Go owns full syntax and arithmetic validation; display server errors with positions without duplicating the parser in React.
- Show a loading state and disable inputs and Calculate while a request is pending to prevent duplicate submissions and mismatched results.
- Clear old output when the expression changes. Clear resets fields, result, and errors when no request is pending.
- Support Enter to submit, keyboard navigation, visible focus, associated labels, and an announced result/error region.
- Center one calculator card between the compact wordmark header and author-credit footer. Reduce padding on narrow screens and preserve the credit, with no horizontal scrolling at a 320px viewport.

## Current repository layout

```text
calculator/
  README.md
  PLAN.md
  PROMPT_LOG.md
  .gitignore
  docs/
    API.md
    ARCHITECTURE.md
    FRONTEND.md
    screenshots/
  frontend/
    package.json
    package-lock.json
    src/
      App.tsx
      App.test.tsx
      main.tsx
      components/Calculator.tsx
      components/ExpressionInput.tsx
      components/ResultPanel.tsx
      components/Keypad.tsx
      api/calculator.ts
      api/calculator.test.ts
      test/setup.ts
      styles.css
  backend/
    go.mod
    cmd/server/main.go
    internal/calculator/calculator.go
    internal/calculator/calculator_test.go
    internal/calculator/tokenizer.go
    internal/calculator/parser.go
    internal/calculator/parser_test.go
    internal/httpapi/handler.go
    internal/httpapi/handler_test.go
```

This overview lists the main sources and documentation. App owns page layout; Calculator owns shared UI state and composes three presentation components. Tested Node/npm and Go versions are recorded in README, with dependencies captured in the frontend lockfile and Go module configuration.

## Implementation sequence and time budget

| Step | Work and exit condition | Budget |
| --- | --- | --- |
| 1. Foundation | Initialize Git, scaffold React/TypeScript and Go, finalize the API contract and numeric rules. | 20 min |
| 2. Backend | Implement tokenizer, parser, evaluator, bounded validation, and table-driven tests. Precedence and nested parentheses pass. | 65 min |
| 3. Frontend | Build the responsive form, API client, validation, pending state, and result/error display. A calculation succeeds against Go. | 40 min |
| 4. Verification | Add frontend tests, produce both coverage reports, run build/type checks and backend checks, and perform a real browser/API smoke test. | 35 min |
| 5. Documentation and delivery | Replace draft setup notes with verified commands, record limitations and coverage, audit prompt log, commit, push, and record the repository URL. | 25 min |
| Buffer / optional work | Fix defects first; add optional operations or Docker only if the core is complete. | Up to 55 min |

The core target is about 3 hours 5 minutes, with a maximum budget of 4 hours. If time is short, remove optional work before reducing required validation, tests, or documentation.

## Test and acceptance plan

| Layer | Required evidence |
| --- | --- |
| Arithmetic unit tests | All four operators, precedence, left associativity, nested parentheses, unary signs, decimals, whitespace, full-input consumption, syntax errors and positions, computed/negative-zero divisors, and result overflow. Check 256/257-character and 32/33-depth boundaries and long unary chains. Use the acceptance cases in API.md. Use tolerances for floating-point comparisons. |
| HTTP handler tests | Valid request/response; malformed JSON; missing/null/non-string expression; unknown fields including the previous operation/operands shape; trailing JSON; syntax/length/depth/domain errors; oversized body; wrong method/content type; expected status and JSON error envelope. Use `httptest`. |
| Frontend unit/component tests | Empty and overlong expressions; legitimate `0`; successful backend result; exact submitted expression; server syntax errors and positions; pending state; API validation errors; network failure; Clear; keyboard form submission; clearing stale output after edits. Use Vitest and React Testing Library. |
| Integration smoke test | Run both services, calculate `2+3+5/4` and `(2+3+5)/4` through the browser, check division-by-zero feedback and backend-unavailable feedback, and inspect a narrow viewport. Mocked frontend tests alone do not establish real integration. |
| Coverage | Save Go text/HTML coverage and frontend text/HTML coverage. Review arithmetic and error branches and record actual measured figures; no coverage percentage is prescribed by the assignment. |
| Build and static checks | Frontend production build and TypeScript checking; `go test ./...` and `go vet ./...`. |

Backend unit tests pass with the race detector; build and `go vet` pass. Calculator coverage is 99.4%, HTTP coverage is 95.5%, and overall backend coverage is 89.8%. A five-second fuzz run passed 525,169 executions. A live HTTP check verified expression results, positioned errors, request limits/validation, and shutdown. Frontend: 26 tests pass, with 97.95% statement coverage and a successful TypeScript/production build. Browser checks against the real backend cover results, errors, outage recovery, and desktop/320px mobile layout.

## Optional features

### Backend extension — implemented

The agreed extension is implemented in the backend, including parser/evaluator tests and HTTP error mapping. API.md describes the supported contract. Frontend controls remain deferred.

#### Syntax and semantics

| Operation | Expression syntax | Implemented behavior |
| --- | --- | --- |
| Exponentiation | `2^3` | Returns `8`. Right-associative: `2^3^2` means `2^(3^2)` and returns `512`. |
| Square root | `sqrt(9)` | Returns `3`. Requires parentheses and accepts a complete expression, such as `sqrt(4+5)`. Only the exact lowercase function name is supported. |
| Percentage | `25%` | Postfix conversion to a fraction: `25/100`, returning `0.25`. `%` is not modulo. |

Percentage is deliberately context-independent: `200*10%` is `20`, while `200+10%` is `200.1`. To increase 200 by ten percent, write `200*(1+10%)`. The evaluator does not infer a percentage base from the surrounding addition/subtraction.

The implemented precedence rules are:

- Parentheses and square-root calls form primary expressions.
- Postfix `%` binds tighter than exponentiation: `2^3%` means `2^(3/100)`; `(2^3)%` is `0.08`.
- Exponentiation binds tighter than a leading sign: `-2^2` is `-4`, while `(-2)^2` is `4`. Negative exponents are accepted: `2^-3` is `0.125`.
- Multiplication/division and addition/subtraction retain their current precedence and left associativity.
- Accept one `%` per postfix expression; reject `10%%`. Explicit nesting such as `(10%)%` is allowed and means repeated division by 100.

The grammar extends the existing recursive-descent parser:

```text
expression = term { ("+" | "-") term }
term       = unary { ("*" | "/") unary }
unary      = { "+" | "-" } power
power      = postfix [ "^" unary ]
postfix    = primary [ "%" ]
primary    = number | "(" expression ")" | "sqrt" "(" expression ")"
```

Number syntax remains unchanged. The exponent's reference to `unary` permits signed exponents and right-associative powers without changing `2*-3` or chained unary signs.

#### Changes by backend layer

| Layer | Implemented changes |
| --- | --- |
| Tokenizer | Recognize `^`, `%`, and the exact identifier `sqrt`, preserving source positions. Reject other names and retain the existing decimal/whitespace rules. |
| Parser | Add `parsePower` and `parsePostfix`; make `parseUnary` consume a power. Extend `parsePrimary` for the parenthesized square-root call. Count square-root parentheses toward the existing nesting limit. |
| Expression tree | Reuse binary nodes for power and unary nodes for percentage/square root; each operation still carries its token position. No new design pattern or operator registry is required. |
| Evaluator | Add power and square root using Go's `math.Pow` and `math.Sqrt`; implement percentage as division by 100. Check domains and finite intermediate results. |
| HTTP handler | Preserve the endpoint, JSON request/response shapes, and positioned errors. Map a new `INVALID_ARGUMENT` domain error to HTTP `422`. |
| Tests/docs | Extend tokenizer/parser/evaluator and HTTP tests; update API grammar, supported syntax, numeric rules, and examples once implemented. |

The request remains `{"expression":"sqrt(16)+2^3+50%"}` and the successful response is `{"result":12.5}`. Parsing and domain evaluation remain separate: malformed syntax is rejected before arithmetic.

#### Domain and limit rules

- Keep real-number `float64` arithmetic, finite-result checks, and final negative-zero normalization.
- Return `422 INVALID_ARGUMENT` for a negative square-root argument, a negative power base with a noninteger exponent, `0^0`, or zero raised to a negative exponent. Rejecting `0^0` is an explicit agreed product choice.
- Point domain errors to the beginning of `sqrt` or to `^`; retain zero-based code-point offsets.
- Return the existing `422 NON_FINITE_RESULT` for overflow such as `2^1024`.
- Preserve the 4096-byte request limit, 256-code-point expression limit, and 32-level parenthesis limit. Test the additional recursion from power chains and combinations with nested function calls; it must remain bounded by expression length.
- Keep scientific notation, implicit multiplication, alternate power syntax (`**`), other function names, and complex results outside this extension.

#### Backend acceptance examples

| Expression | Result/error |
| --- | --- |
| `2^3` | `8` |
| `2^3^2` | `512` |
| `-2^2` | `-4` |
| `(-2)^2` | `4` |
| `2^-3` | `0.125` |
| `sqrt(4+5)` | `3` |
| `sqrt(sqrt(16))` | `2` |
| `200*10%` | `20` |
| `200+10%` | `200.1` |
| `(2^3)%` | `0.08` |
| `sqrt(16)+2^3+50%` | `12.5` |
| `sqrt(-1)` | `INVALID_ARGUMENT` at position `0` |
| `(-2)^0.5` | `INVALID_ARGUMENT` at position `4` |
| `0^0`, `0^-1` | `INVALID_ARGUMENT` at position `1` |
| `2^1024` | `NON_FINITE_RESULT` at position `1` |
| `sqrt(4)+` | `INVALID_EXPRESSION` at end of input |
| `10%%`, `2^`, `sqrt()`, `sqrt 9` | `INVALID_EXPRESSION` |

Retain all existing acceptance tests, including subtraction/unary signs, syntax-before-domain errors, input boundaries, and division by zero. Add HTTP checks for domain error status/code/positions and fuzz seeds covering each new syntax form.

Verification complete: all backend tests pass with the race detector, `go vet` and the standalone build pass, the fuzz run passed 525,169 executions, and live HTTP checks passed twelve calculations and seven positioned errors. No frontend source changes are included in this milestone.

### Other optional work

Docker: after the ordinary local workflow works, use a multi-stage build and either serve the built frontend from Go in one container or document a Compose setup. Verify build/run instructions before advertising support.

## Delivery checklist

- [x] Implement backend parsing/evaluation with the required operators, precedence, and nested parentheses.
- [x] Implement frontend expression input.
- [x] Verify responsive and accessible form behavior and both layers of validation.
- [x] Run tests, build/static checks, and a smoke test against the real backend.
- [x] Generate coverage reports and record measured results and report paths in README.
- [x] Update README and API documentation to match actual behavior, versions, and commands.
- [x] Keep `PROMPT_LOG.md` current with prompts used during implementation and any other AI tools.
- [x] Add `.gitignore` entries for dependencies, build outputs, generated coverage, and local configuration; do not commit secrets.
- [ ] Commit the solution, push to the user's chosen Git host, and verify evaluator access.
- [ ] Add the actual repository URL and share it for evaluation with the prompt log.

Current milestone: the full-stack calculator is implemented and verified locally. Publication and sharing the repository link remain delivery steps.
