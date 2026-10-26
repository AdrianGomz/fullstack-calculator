# Full-stack calculator

A Go REST service with a planned React + TypeScript frontend.

**Current status:** the backend foundation runs. It provides a health check, JSON routing errors, configurable port, and graceful shutdown. Calculation currently returns `501 NOT_IMPLEMENTED`; request validation, expression parsing, arithmetic, and the frontend are the next milestones.

## Documentation

- [Implementation plan](PLAN.md): scope, architecture, milestones, testing, and delivery checklist.
- [API contract](docs/API.md): current endpoints and the planned expression contract.
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

Expected: HTTP `200`, JSON `{"status":"ok"}`. This reports that the HTTP service is running; it does not indicate that calculation is implemented.

Calculation placeholder:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"(2+3)*4"}'
```

Expected **currently**: HTTP `501` and:

```json
{
  "error": {
    "code": "NOT_IMPLEMENTED",
    "message": "Expression calculation is not implemented yet."
  }
}
```

The placeholder does not parse or validate the body. Unsupported methods at known endpoints return `405` with an `Allow` header; unknown paths return `404`. Endpoint responses use JSON.

## Backend checks and coverage

From the repository root:

```bash
cd backend
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out
go tool cover -html=coverage.out -o coverage.html
go vet ./...
```

Tests cover default/custom/invalid port configuration, health responses, the calculation placeholder, method restrictions, and unknown paths. Coverage files are generated locally and ignored by Git. Whole-application coverage is not final while the parser and frontend are pending.

Verified on Go 1.25.4: `go test ./...`, `go vet ./...`, and the standalone build pass. Foundation statement coverage is **53.7% overall** and **95.2% for the HTTP package**; port configuration is fully covered, while the entry point/server lifecycle are verified separately by a live smoke test. That check exercised health, the calculation placeholder, 404/405 responses, an occupied port, invalid `PORT`, and clean SIGTERM shutdown. This is foundation coverage, not a report for the completed calculator.

To build a standalone executable from `backend/`:

```bash
go build -o bin/calculator ./cmd/server
./bin/calculator
```

## Next implementation steps

1. Add bounded JSON request decoding and expression validation.
2. Implement and test the tokenizer, recursive-descent parser, and evaluator, including precedence, unary signs, and nested parentheses.
3. Add the React/TypeScript frontend and connect it through a Vite `/api` proxy to port 8080.
4. Run the full acceptance checks and publish measured coverage and the repository link.

The planned calculation response for `{"expression":"(2+3)*4"}` is `{"result":20}`. See the [API contract](docs/API.md) for grammar, limits, and errors. Frontend setup commands will be added when its manifests and scripts exist.

## Design decisions and assumptions

- The server entry point owns configuration, HTTP timeouts, signals, and shutdown; `internal/httpapi` constructs routes independently of a listener for testing.
- Go owns arithmetic. A separate tokenizer/parser/evaluator will accept only the documented arithmetic grammar.
- One expression field supports multiple operators and parentheses. Go will enforce full validation; React will check presence/length and show server errors with positions.
- Binary floating-point can produce decimal rounding artifacts; the application is not intended for exact financial arithmetic.
- Calculations are stateless; no accounts or database are required.
- Advanced operations and Docker follow completion of the required functionality.

## Submission status

- Backend foundation: implemented; expression calculation and frontend: pending.
- Git repository: initialized locally; publication and evaluator access: pending.
- Repository URL: pending.
- Prompt record: [PROMPT_LOG.md](PROMPT_LOG.md); append prompts used in subsequent work and other AI tools.
