# Calculator application plan

Date: 2026-10-25  
Status: backend and React/TypeScript frontend are implemented, tested, and verified together locally. Remote publication remains pending.

## Objective and scope

Build a full-stack calculator with a React frontend that calls a Go REST microservice for arithmetic. Prioritize correctness, clear code, and testable boundaries within approximately 2–4 hours of implementation work.

The assignment requires addition, subtraction, multiplication, and division; frontend and backend validation; a responsive UI; JSON responses; unit tests for both layers; coverage reports; setup/API/design documentation; and submission of a Git repository link and prompts used.

The assignment treats exponentiation, square root, percentage, and Docker as optional. The three arithmetic operations are now implemented in the backend after completion of the required functionality. Dedicated frontend controls and help are implemented; Docker Compose packaging is implemented and verified locally.

User-approved extension: evaluate complete expressions, including nested parentheses. `2+3+5/4` yields `6.25`; `(2+3+5)/4` yields `2.5`.

## Proposed design decisions

Expression input, standard precedence, and nested parentheses are user-approved requirements. The remaining implementation choices are proposals.

| Area | Choice | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, CSS Modules | Small setup, explicit types, minimal styling dependencies. |
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
- Clear old output when the expression changes. The expression starts at `0`; Clear restores `0` and removes the result/errors when no request is pending. Number/parenthesis entry replaces the lone zero, operators retain it, decimal entry produces `0.`, and Square root replaces it with `sqrt()`.
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
      App.module.css
      App.test.tsx
      main.tsx
      components/Calculator.tsx
      components/Calculator.module.css
      components/ExpressionInput.tsx
      components/ExpressionInput.module.css
      components/ResultPanel.tsx
      components/ResultPanel.module.css
      components/Keypad.tsx
      components/Keypad.module.css
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

Backend unit tests pass with the race detector; build and `go vet` pass. Calculator coverage is 99.4%, HTTP coverage is 95.5%, and overall backend coverage is 89.8%. A five-second fuzz run passed 525,169 executions. A live HTTP check verified expression results, positioned errors, request limits/validation, and shutdown. Frontend: 163 tests pass, with 98.69% statement coverage, 95.48% branch coverage, and a successful TypeScript/production build. Browser checks against the real backend cover results, errors, outage recovery, and desktop/320px mobile layout.

## Optional features

### Backend extension — implemented

The agreed extension is implemented in the backend, including parser/evaluator tests and HTTP error mapping. API.md describes the supported contract. Frontend controls are also implemented, as described below.

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

### Frontend extension — implemented

The backend already accepts the new syntax through the existing expression request. The approved extension adds discoverable controls and editing assistance; it does not duplicate arithmetic in React.

| Control | Display/accessibility | Implemented editing behavior |
| --- | --- | --- |
| Exponentiation | `xʸ`, accessible name “Power” | Insert `^()` and place the cursor inside; with a selection, wrap it in `^(...)` and place the cursor after the closing parenthesis. |
| Square root | `√`, accessible name “Square root” | With no selection, insert `sqrt()` and place the cursor inside. With selected text, wrap it in `sqrt(...)` and place the cursor after the closing parenthesis. |
| Percentage | `%`, accessible name “Percentage” | Insert `%` using the existing cursor/selection replacement behavior. |

Use a single four-column keypad with six rows: parentheses/Clear/Backspace; power/root/percentage/division; 7/8/9/multiplication; 4/5/6/addition; 1/2/3/subtraction; and 0/decimal/equals. Equals spans the final two columns. Controls remain disabled during pending requests, and the card stays centered with mobile touch-target sizes preserved.

Implemented source changes:

- `Keypad.tsx`: render the six-row keypad with explicit accessible names and the appropriate editing actions; keep all arithmetic on the backend.
- `Calculator.tsx`: extend insertion for balanced power/square-root templates, selection wrapping, and initial/cleared-zero behavior, restoring focus/cursor after React updates. Keep template insertion literal; the later context-editing milestone below adds explicit multiplication before digit keys after `)` or `%`. Evaluation remains on the backend.
- `ExpressionInput.tsx`: update help to list `^`, `sqrt(...)`, and `%`. Add concise percentage guidance: `10% = 0.1`; `200*10% = 20`, while `200+10% = 200.1`. Keep the existing character-count limit and accessible help relationships.
- CSS Modules: `Keypad.module.css` owns the four-column grid and two-column equals key; `ExpressionInput.module.css` owns wrapping help text. Other components have matching modules, while `styles.css` retains only shared base styles and theme variables.
- Existing API client and ResultPanel continue to use the same request, finite result validation, loading state, and positioned server errors. No new React component or custom hook is required.

Acceptance checks before completion:

- New controls insert the exact API syntax at the cursor or replace the current selection, as specified above.
- Empty and selected-text square-root insertion, caret placement, surrounding-text preservation, Clear/Backspace, pending-state disabling, and the 256-character validation path work together.
- Requests preserve the resulting expression exactly. The UI shows successful advanced results and server domain errors, including highlighting `sqrt`/`^` positions through the existing error-selection behavior.
- Existing interaction/client tests remain passing; add component tests for the new editing actions and representative result/error paths.
- Verify live requests for `2^3^2`, `sqrt(9)`, `200*10%`, and a domain error; check desktop and 320px mobile layout.
- Update the frontend guide, README, and desktop/mobile screenshots once implemented. Do not add a header screenshot or a screenshots README.

Verification complete on 2026-10-26: 37 frontend tests pass with 98.05% statement and 93.51% branch coverage; TypeScript/production build pass. Browser checks against Go verified all three controls, square-root selection wrapping, a positioned domain error, and the combined expression result. Desktop and 320px mobile screenshots were refreshed, with no horizontal overflow and 52px keypad buttons.

### Other optional work

Docker: the two-container Compose workflow is implemented and verified. Architecture, files, and measured results are documented below.

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

## Implemented keypad operator substitution

This is a frontend editing aid: when the cursor is at the end with no text selected and the expression ends in an operator, a mapped operator key replaces it. This prevents repeated operators and accidental pairs such as `+/`. Go remains responsible for validating the full expression. Keyboard typing, pasting, and edits within an expression retain their existing behavior. Trailing whitespace retains normal insertion behavior.

| Existing trailing operator | Incoming keys that replace it |
| --- | --- |
| `+` | `+`, `-`, `*`, `/`, `%`, `^` |
| `-` | `-`, `+`, `*`, `/`, `%`, `^` |
| `*` | `*`, `+`, `/`, `%`, `^` |
| `/` | `/`, `+`, `*`, `%`, `^` |
| `%` | `%` only |
| `^` | `^`, `+`, `*`, `/`, `%` |

Examples: `2+` then Divide becomes `2/`; `2-` then Add becomes `2+`; repeated Percentage leaves `50%`. Percentage is postfix: `50%` then Add appends `+`, producing `50%+`.

Minus may introduce a negative operand after multiplication, division, or power: `2*-`, `2/-`, and `2^(-)` remain possible. After plus or minus, an incoming minus replaces the existing sign as listed. If a binary operator already has a pending unary minus (`2*-`), replacing that unfinished operation with Divide should produce `2/`, avoiding `2*/`.

Power substitution applies only when the expression ends in a bare `^`, such as `2^` after the user manually deletes its parentheses. The balanced `^()` template is excluded, even when the cursor is inside empty parentheses; the context guards below now govern allowed keys there. For example, `2^` then Add becomes `2+`, while `2^()` is not replaced by the substitution rule. Square root retains its existing insertion/wrapping behavior.

Implementation: `frontend/src/utils/operatorSubstitution.ts` isolates the replacement-range decision in a pure helper. Calculator integrates it with existing insertion/caret handling. Table-driven helper tests cover the full matrix; interaction tests cover negative operands, bare power operators, exclusion of balanced power templates, selections, keyboard typing, and corrected API requests. README and the frontend review guide document the behavior. API, parser, and evaluation semantics remain unchanged.

Verification of operator substitution (2026-10-26): all 111 frontend tests pass; statement coverage is 98.48%, branch coverage is 94.8%, and line/function coverage is 100%. TypeScript checks and the production build pass.

## Implemented keypad parentheses and number-entry rules

Apply these rules to keypad clicks with a collapsed selection, using the input cursor's context rather than only the end of the whole expression. Inspect the preceding non-whitespace character. Keyboard typing, pasting, and selected-text editing retain their existing behavior; Go still validates the complete expression.

1. After `(`, allow digits, Square root, and unary Minus. Ignore Add, Multiply, Divide, Percentage, and Power. Apply this inside ordinary grouping, `sqrt()`, and `^()` without removing or replacing their parentheses. An ignored key preserves text, result/error feedback, and caret, returning focus to the input. Allow another `(` for nested grouping and make Decimal insert `0.` to begin a fractional number; block Close parenthesis while the group is empty.
2. Preserve this operand expectation after a minus directly following `(`: repeated Minus keeps one sign, and other arithmetic operators cannot replace it and create an invalid opening such as `(/`. Allow numbers, square root, nested grouping, and decimal entry; block Close parenthesis until an operand exists. This local guard takes precedence over the trailing-operator substitution table.
3. When a digit is inserted immediately after `)` or `%`, insert `*` before that digit and place the caret after it. Examples: `(2+3)` then `4` becomes `(2+3)*4`; `50%` then `2` becomes `50%*2`; `sqrt(9)` then `2` becomes `sqrt(9)*2`. Further digits extend that number without another multiplication sign. Preserve text after the cursor. This rule is limited to digit keys; it does not introduce automatic multiplication for Square root or Open parenthesis.

Implementation: `frontend/src/utils/keypadContext.ts` provides a pure context-editing helper. Calculator runs its guard before operator substitution and reuses its existing insertion/template/caret handling. The substitution matrix is intact for other contexts. Helper and component tests cover allowed/blocked keys, minus and decimal/nested-group cases, both templates, automatic multiplication, cursor/selection behavior, whitespace, and exact submitted expressions. README and the frontend guide describe the rules. Backend grammar and API remain unchanged because the frontend sends an explicit `*`.

Verification of parentheses/number-entry rules (2026-10-26): all 163 frontend tests pass; statement coverage is 98.69%, branch coverage is 95.48%, and line/function coverage is 100%. TypeScript checks and the production build pass.

## Docker implementation

Implemented and verified on 2026-10-27, following the plan drafted on 2026-10-26. Docker Desktop was available at `/Applications/Docker.app/Contents/Resources/bin/docker`, outside the initial shell PATH. Both services build and run locally; no application arithmetic or editing behavior changed.

### Architecture

Use Docker Compose with two services, keeping the Go API as a separate microservice:

```text
Browser -> 127.0.0.1:8081 -> frontend (Nginx :8080)
                              |-- / and static assets -> built React files
                              |-- /api/* -> backend:8080, preserving the path
                              `-- /health -> backend:8080/health
```

The browser continues calling the relative `/api/v1/calculate` URL. Nginx replaces Vite's development proxy in this container setup, so there is no frontend API-host variable or CORS change. Compose service names resolve within its default network; browser code must not call `http://backend:8080` directly. Only Nginx publishes a host port, bound to `127.0.0.1`; the backend port remains available inside the Compose network.

### Files and responsibilities

| File | Implementation |
| --- | --- |
| `backend/Dockerfile` | Multi-stage build: compile with `golang:1.26.10-alpine3.24`, compatible with the Go 1.25 minimum in `go.mod`; set `CGO_ENABLED=0` and build `./cmd/server`. Copy only the executable into an `alpine:3.24.0` runtime, run as UID 10001 on port 8080, and use exec-form startup so Go receives SIGTERM directly. |
| `backend/.dockerignore` | Exclude local executables, coverage, editor files, and local environment files from the backend build context. |
| `frontend/Dockerfile` | Multi-stage build: use `node:24.21.0-alpine3.24`, meeting `engines`, copy the package manifests first, run `npm ci`, copy source, and run `npm run build`. Copy only `dist` and Nginx configuration into `nginx:1.30.6-alpine3.24`, configured to run without root on port 8080. |
| `frontend/nginx.conf` | Serve built React assets and proxy `/api/` and exact `/health` to Go. Preserve API paths, JSON error bodies, and HTTP statuses; never serve the React HTML fallback for API requests. Send logs to stdout/stderr and use writable temporary paths for the non-root runtime. |
| `frontend/.dockerignore` | Exclude host `node_modules`, `dist`, coverage, editor files, and local environment files; install/build inside the image. |
| `compose.yaml` | Build from `./backend` and `./frontend`, name services `backend` and `frontend`, set backend `PORT=8080`, and publish `127.0.0.1:${CALCULATOR_HTTP_PORT:-8081}:8080` for frontend only. Add HTTP health checks and make frontend depend on a healthy backend. Allow at least ten seconds for backend shutdown, exceeding Go's five-second graceful-shutdown window. |

Base images use explicit version tags rather than `latest`. Their published manifests include Linux ARM64 and AMD64; no CPU architecture is hardcoded. Build stages contain compilers/dependencies; runtime images contain only what the running services need. No database, bind mounts, persistent volumes, credentials, or mandatory `.env` file are required. This is a built application workflow; continue using the existing Go/Vite commands for hot reload.

### Verification results

- [x] Added both multi-stage Dockerfiles, per-app ignore files, and non-root Nginx configuration. Clean builds used `npm ci` and Go compilation inside Linux, excluding host dependencies and binaries.
- [x] Validated Compose configuration and started both services with `docker compose up --build --wait --wait-timeout 60`. Both HTTP health checks passed; Nginx configuration validation passed.
- [x] Passed 20 HTTP checks through Nginx on each of ports 8081 and 9090: HTML/assets, health/query forwarding, calculations, syntax/domain/division errors with positions, schema/media/body validation, and JSON API 404/405 responses including the Allow header. A real browser calculation returned `12.5`.
- [x] Confirmed non-root runtime users (Go UID 10001, Nginx UID 101), private backend port, and localhost-only frontend port. Go received SIGTERM, logged graceful shutdown, and exited with code 0.
- [x] Recreated the backend with a different internal IP and verified Nginx recovered through Docker DNS. `docker compose down` removed both containers and their network; the port override and subsequent default-port startup worked.
- [x] Ran the Go test suite and all 163 frontend tests in the Linux build stages with network access disabled. The frontend TypeScript/production build passed inside its image.
- [x] Updated README with runnable prerequisites, build/start, health/API checks, logs, port override, rebuild, stop, and optional container-based unit-test commands.

Verification environment: Docker Desktop 4.97.0, Engine 29.9.2, Compose 5.6.1, Linux ARM64. ARM64 execution is verified; AMD64 image-manifest availability is verified, but AMD64 execution was not tested. The two runtime containers are left running at `http://127.0.0.1:8081/`. External deployment remains outside this milestone.

References: Docker documents [multi-stage builds](https://docs.docker.com/build/building/multi-stage/), [Compose service networking](https://docs.docker.com/compose/how-tos/networking/), [health-based startup ordering](https://docs.docker.com/compose/how-tos/startup-order/), and [`docker compose up` options](https://docs.docker.com/reference/cli/docker/compose/up/).
