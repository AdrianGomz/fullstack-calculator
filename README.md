# Full-stack calculator

A Go REST service with a planned React + TypeScript frontend.

**Current status:** the Go backend evaluates expressions with addition, subtraction, multiplication, division, unary signs, decimals, and nested parentheses. It validates requests, returns positioned errors, and includes a health check, configurable port, and graceful shutdown. The frontend remains planned.

## Documentation

- [Implementation plan](PLAN.md): scope, architecture, milestones, testing, and delivery checklist.
- [API contract](docs/API.md): implemented endpoints, grammar, limits, and error responses.
- [Calculator design](docs/ARCHITECTURE.md): tokenizer, parser, expression tree, and evaluator.
- [Prompt log](PROMPT_LOG.md): user prompts supplied for this app.

## Run the backend

Requires Go 1.25 or newer. Tested locally with Go 1.25.4 on macOS/arm64. The backend uses only the Go standard library, so no dependency installation, database, credentials, or `.env` file is needed.

From the repository root:

```bash
cd backend
go run ./cmd/server
```

The server listens on port `8080` on all network interfaces. Override the port when needed:

```bash
PORT=9090 go run ./cmd/server
```

`PORT` must be an integer from 1 through 65535. Invalid configuration or an occupied port causes a startup error and a nonzero exit. Stop the server with Ctrl+C; it allows up to five seconds for active requests to finish. The service uses standard HTTP read/write/idle timeouts and logs startup, shutdown, and failures.

## Try the current endpoints

Health check:

```bash
curl -i http://localhost:8080/health
```

Expected: HTTP `200`, JSON `{"status":"ok"}`.

Calculate an expression:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"(2+3)*4"}'
```

Expected: HTTP `200`, JSON `{"result":20}`.

Precedence is respected: `2+3+5/4` returns `6.25`, while `(2+3+5)/4` returns `2.5`. A single number is also a valid expression. Multiplication must be explicit, so use `2*(3+4)`.

For `10/(3-3)`, the API returns HTTP `422`:

```json
{
  "error": {
    "code": "DIVISION_BY_ZERO",
    "message": "Cannot divide by zero.",
    "position": 2
  }
}
```

Positions are zero-based code-point offsets in the original expression. Syntax and schema errors return `400`; oversized bodies return `413`; unsupported Content-Type returns `415`. Unsupported methods return `405` with an `Allow` header, and unknown paths return `404`.

Requests are limited to 4096 bytes, expressions to 256 characters, and parenthesis nesting to 32. Only the exact `expression` key is accepted; unknown/duplicate fields, nulls, and trailing JSON are rejected. See the [API contract](docs/API.md) for details.

## Backend checks and coverage

From the repository root:

```bash
cd backend
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out
go tool cover -html=coverage.out -o coverage.html
go vet ./...
```

Tests cover tokenization, tree structure, precedence, associativity, nested parentheses, unary signs, decimals, error positions, numeric guards, request validation, input limits, routing, and port configuration. Coverage files are generated locally and ignored by Git.

Verified on Go 1.25.4: `go test -race ./... -coverprofile=coverage.out`, `go vet ./...`, and the standalone build pass. Statement coverage is **87.9% overall**, **99.2% for the calculator package**, and **95.5% for HTTP**. The server entry point/lifecycle is checked separately over HTTP rather than included in unit-test coverage.

A five-second fuzz run completed **512,366 executions** without failures. A live test against the built server verified health, six calculations, five positioned expression errors, three request errors, and clean SIGTERM shutdown. This validates the backend; browser integration remains pending.

To repeat the short fuzz check from `backend/`:

```bash
go test ./internal/calculator -run='^$' -fuzz=FuzzEvaluate -fuzztime=5s -parallel=2
```

To build a standalone executable from `backend/`:

```bash
go build -o bin/calculator ./cmd/server
./bin/calculator
```

## Next implementation steps

1. Add the React/TypeScript frontend and connect it through a Vite `/api` proxy to port 8080.
2. Verify the full browser workflow and frontend coverage.
3. Publish the repository and coverage artifacts for evaluation.

Frontend setup commands will be added when its manifests and scripts exist. Exponentiation, square root, and percentage remain optional future work.

## Design decisions and assumptions

- The server entry point owns configuration, HTTP timeouts, signals, and shutdown; `internal/httpapi` constructs routes independently of a listener for testing.
- Go owns arithmetic. A separate tokenizer/parser/evaluator accepts only the documented arithmetic grammar. The parser builds a tree before arithmetic begins, so syntax errors take priority over division errors.
- One expression field supports multiple operators and parentheses. Go enforces full validation; React will check presence/length and show server errors with positions.
- Binary floating-point can produce decimal rounding artifacts; the application is not intended for exact financial arithmetic.
- Calculations are stateless; no accounts or database are required.
- Advanced operations and Docker follow completion of the required functionality.

## Submission status

- Backend expression calculation and tests: implemented; frontend: pending.
- Git repository: initialized locally; publication and evaluator access: pending.
- Repository URL: pending.
- Prompt record: [PROMPT_LOG.md](PROMPT_LOG.md); append prompts used in subsequent work and other AI tools.
