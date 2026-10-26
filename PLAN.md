# Calculator application plan

Date: 2026-10-25  
Status: planning only; application code, tests, coverage, and remote repository are not yet created.

## Objective and scope

Build a full-stack calculator with a React frontend that calls a Go REST microservice for arithmetic. Prioritize correctness, clear code, and testable boundaries within approximately 2–4 hours of implementation work.

The assignment requires addition, subtraction, multiplication, and division; frontend and backend validation; a responsive UI; JSON responses; unit tests for both layers; coverage reports; setup/API/design documentation; and submission of a Git repository link and prompts used.

Exponentiation, square root, percentage, and Docker are optional. Implement them only after the required features, tests, and documentation are complete. Although the objective mentions advanced operations, the detailed requirements explicitly mark them optional; document any omissions in the final README.

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

Use a labeled expression field, a Calculate button, a Clear button, and a visible result/error area. Show an example with parentheses; a custom keypad is not required.

- Support multiple operators, nested parentheses, unary signs, decimals, zero, and whitespace. Require complete expression parsing; never accept only the valid prefix of `12abc`.
- Validate nonempty input and a 256-character limit locally. Go owns full syntax and arithmetic validation; display server errors with positions without duplicating the parser in React.
- Show a loading state and disable inputs and Calculate while a request is pending to prevent duplicate submissions and mismatched results.
- Clear old output when the expression changes. Clear resets fields, result, and errors when no request is pending.
- Support Enter to submit, keyboard navigation, visible focus, associated labels, and an announced result/error region.
- Use a compact desktop layout that stacks on narrow mobile screens, with no horizontal scrolling at a 320px viewport.

## Planned repository layout

```text
calculator/
  README.md
  PLAN.md
  PROMPT_LOG.md
  .gitignore
  docs/
    API.md
  frontend/
    package.json
    package-lock.json
    src/
      App.tsx
      App.test.tsx
      api/calculator.ts
      api/calculator.test.ts
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

The layout is illustrative. Keep small UI components together until separating them improves readability. Record actual Node/npm and Go versions after selecting and testing the toolchain; commit lockfiles and the Go module version.

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

No tests have been run yet because this is a documentation-only planning deliverable.

## Optional features

Define semantics before implementing an optional operation and extend tests and API documentation together:

- Exponentiation: define syntax, associativity, precedence relative to unary signs, and `0^0` behavior; reject non-real/non-finite results.
- Square root: define function syntax and require a nonnegative argument.
- Percentage: define expression syntax with `x / 100` semantics; this is not the contextual percentage behavior of some physical calculators.
- Docker: after the ordinary local workflow works, use a multi-stage build and either serve the built frontend from Go in one container or document a Compose setup. Verify build/run instructions before advertising support.

## Delivery checklist

- [ ] Implement expression input and backend parsing/evaluation with the required operators, precedence, and nested parentheses.
- [ ] Verify responsive and accessible form behavior and both layers of validation.
- [ ] Run tests, build/static checks, and a smoke test against the real backend.
- [ ] Generate coverage reports and record measured results and report paths in README.
- [ ] Update README and API documentation to match actual behavior, versions, and commands.
- [ ] Keep `PROMPT_LOG.md` current with prompts used during implementation and any other AI tools.
- [ ] Add `.gitignore` entries for dependencies, build outputs, generated coverage, and local configuration; do not commit secrets.
- [ ] Commit the solution, push to the user's chosen Git host, and verify evaluator access.
- [ ] Add the actual repository URL and share it for evaluation with the prompt log.

Creating a remote repository, implementing code, and publishing the solution are later assignment steps; the current requested output is this plan and its supporting documentation.
