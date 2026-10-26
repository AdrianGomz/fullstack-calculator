# Calculator application plan

Date: 2026-10-25  
Status: planning only; application code, tests, coverage, and remote repository are not yet created.

## Objective and scope

Build a full-stack calculator with a React frontend that calls a Go REST microservice for arithmetic. Prioritize correctness, clear code, and testable boundaries within approximately 2–4 hours of implementation work.

The assignment requires addition, subtraction, multiplication, and division; frontend and backend validation; a responsive UI; JSON responses; unit tests for both layers; coverage reports; setup/API/design documentation; and submission of a Git repository link and prompts used.

Exponentiation, square root, percentage, and Docker are optional. Implement them only after the required features, tests, and documentation are complete. Although the objective mentions advanced operations, the detailed requirements explicitly mark them optional; document any omissions in the final README.

## Proposed design decisions

These are planning choices, not additional requirements supplied by the user.

| Area | Choice | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, plain CSS | Small setup, explicit types, minimal styling dependencies. |
| Backend | Go standard library `net/http` and `encoding/json` | Enough for a small REST service without a framework. |
| API | `POST /api/v1/calculate` with an operation and operands | One consistent request/response contract for all operations. |
| Calculation | Pure Go function separated from HTTP handlers | Arithmetic and transport behavior can be tested independently. |
| Frontend API access | A small typed `fetch` wrapper | Centralized JSON parsing, HTTP errors, and network error handling. |
| State | Local React state | No shared global state or persistence is needed. |
| Numbers | Go `float64` / JavaScript numbers | Appropriate for a general calculator; document binary floating-point limitations. |
| Development | Vite proxies `/api` to Go on port 8080 | Browser requests use the frontend origin without separate CORS configuration. |
| Storage/authentication | Neither in the assignment scope | Calculations are stateless and require no accounts. |

Do not evaluate arbitrary expression strings. Use explicit operation names and numeric operands. Keep calculation results on the backend; frontend validation improves usability but never replaces server validation.

## User experience

Use a labeled form with two operand inputs, an operation selector, a Calculate button, a Clear button, and a visible result/error area. This keeps the assignment focused without building an expression parser or a complex keypad state machine.

- Support negative numbers, decimals, and zero. Require complete numeric input; empty strings and partially valid strings such as `12abc` must not become numbers.
- Validate required fields and finite numbers before submission. Show understandable field errors and server errors.
- Show a loading state and disable inputs and Calculate while a request is pending to prevent duplicate submissions and mismatched results.
- Clear old output when operands or the operation change. Clear resets fields, result, and errors when no request is pending.
- Support Enter to submit, keyboard navigation, visible focus, associated labels, and an announced result/error region.
- Use a compact desktop layout that stacks on narrow mobile screens, with no horizontal scrolling at a 320px viewport.
- If square root is added, show only one operand input for that operation.

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
    internal/httpapi/handler.go
    internal/httpapi/handler_test.go
```

The layout is illustrative. Keep small UI components together until separating them improves readability. Record actual Node/npm and Go versions after selecting and testing the toolchain; commit lockfiles and the Go module version.

## Implementation sequence and time budget

| Step | Work and exit condition | Budget |
| --- | --- | --- |
| 1. Foundation | Initialize Git, scaffold React/TypeScript and Go, finalize the API contract and numeric rules. | 20 min |
| 2. Backend | Implement pure arithmetic, JSON handler validation, consistent errors, and table-driven unit/handler tests. Required operations pass. | 40 min |
| 3. Frontend | Build the responsive form, API client, validation, pending state, and result/error display. A calculation succeeds against Go. | 40 min |
| 4. Verification | Add frontend tests, produce both coverage reports, run build/type checks and backend checks, and perform a real browser/API smoke test. | 35 min |
| 5. Documentation and delivery | Replace draft setup notes with verified commands, record limitations and coverage, audit prompt log, commit, push, and record the repository URL. | 25 min |
| Buffer / optional work | Fix defects first; add optional operations or Docker only if the core is complete. | Up to 80 min |

The core target is about 2 hours 40 minutes, with a maximum budget of 4 hours. If time is short, remove optional work before reducing required validation, tests, or documentation.

## Test and acceptance plan

| Layer | Required evidence |
| --- | --- |
| Arithmetic unit tests | All four operations, negatives, decimals, zero, division by zero including negative zero, unsupported operation, wrong operand count, non-finite inputs and result overflow. Use tolerances for floating-point comparisons. |
| HTTP handler tests | Valid request/response; malformed JSON; missing fields; null/string/object operands; unknown fields; trailing JSON; bad operation or arity; domain errors; oversized body; wrong method/content type; expected status and JSON error envelope. Use `httptest`. |
| Frontend unit/component tests | Empty and malformed inputs; legitimate zero; successful backend result; submitted operation and operands; pending state; API validation errors; network failure; Clear; keyboard form submission; clearing stale output after edits. Use Vitest and React Testing Library. |
| Integration smoke test | Run both services, calculate through the browser, check division-by-zero feedback and backend-unavailable feedback, and inspect a narrow viewport. Mocked frontend tests alone do not establish real integration. |
| Coverage | Save Go text/HTML coverage and frontend text/HTML coverage. Review arithmetic and error branches and record actual measured figures; no coverage percentage is prescribed by the assignment. |
| Build and static checks | Frontend production build and TypeScript checking; `go test ./...` and `go vet ./...`. |

No tests have been run yet because this is a documentation-only planning deliverable.

## Optional features

Define semantics before implementing an optional operation and extend tests and API documentation together:

- `power`: two operands; reject non-real or non-finite results. Document the selected behavior for `0^0`.
- `sqrt`: one nonnegative operand.
- `percentage`: one operand, defined as `x / 100`; this is not the contextual percentage behavior of some physical calculators.
- Docker: after the ordinary local workflow works, use a multi-stage build and either serve the built frontend from Go in one container or document a Compose setup. Verify build/run instructions before advertising support.

## Delivery checklist

- [ ] Implement frontend and backend with the required operations.
- [ ] Verify responsive and accessible form behavior and both layers of validation.
- [ ] Run tests, build/static checks, and a smoke test against the real backend.
- [ ] Generate coverage reports and record measured results and report paths in README.
- [ ] Update README and API documentation to match actual behavior, versions, and commands.
- [ ] Keep `PROMPT_LOG.md` current with prompts used during implementation and any other AI tools.
- [ ] Add `.gitignore` entries for dependencies, build outputs, generated coverage, and local configuration; do not commit secrets.
- [ ] Commit the solution, push to the user's chosen Git host, and verify evaluator access.
- [ ] Add the actual repository URL and share it for evaluation with the prompt log.

Creating a remote repository, implementing code, and publishing the solution are later assignment steps; the current requested output is this plan and its supporting documentation.
