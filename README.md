# Full-stack calculator

A React + TypeScript calculator backed by a Go REST service.

**Current status:** the Go backend evaluates expressions with addition, subtraction, multiplication, division, exponentiation (`^`), square root (`sqrt(...)`), postfix percentage (`%`), unary signs, decimals, and nested parentheses. It validates requests, returns positioned errors, and includes a health check, configurable port, and graceful shutdown. The responsive frontend supports keyboard entry, an on-screen keypad, positioned errors, loading feedback, and API failure recovery.

## Documentation

- [Implementation plan](PLAN.md): scope, architecture, milestones, testing, and delivery checklist.
- [API contract](docs/API.md): implemented endpoints, grammar, limits, and error responses.
- [Frontend review guide](docs/FRONTEND.md): UI state, interaction flows, API handling, design choices, and alternatives to review.
- [Calculator design](docs/ARCHITECTURE.md): tokenizer, parser, expression tree, and evaluator.
- [Prompt log](PROMPT_LOG.md): user prompts supplied for this app.

## Run locally

Use two terminals: one for Go and one for Vite. Frontend prerequisites are Node.js 24.14 or newer and npm; verified with Node 24.14.1 and npm 11.11.0. Dependency versions are recorded in `frontend/package-lock.json`.

### Backend

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

### Frontend

In another terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open [the calculator](http://127.0.0.1:5173). Vite proxies `/api` to `http://127.0.0.1:8080`, so browser requests use the same origin. If you changed the backend port, set its target when launching Vite:

```bash
API_PROXY_TARGET=http://127.0.0.1:9090 npm run dev
```

Enter an expression and press Enter or `=`. The keypad inserts at the cursor and replaces selected text. The expression starts at `0`; Clear restores `0` and removes the result/errors. Numbers and parentheses replace this lone zero; operators retain it, and the decimal key produces `0.`. Square root replaces it with `sqrt()`. Inputs are disabled while waiting, and requests time out after ten seconds. Editing clears stale output. Syntax errors focus the corresponding character, including an end-of-expression position when a token is missing.

The page contains a compact “Calculator” wordmark, a centered calculator card, and the footer credit “By: Isaac Gomez Ocon.” on both desktop and mobile. `App` renders the page shell; `Calculator` coordinates `ExpressionInput`, `ResultPanel`, and `Keypad`.

The keypad includes Power (`xʸ`), Square root (`√`), and Percentage (`%`). Its six rows follow the documented layout, with the equals button spanning two columns. Power inserts `^()` with the cursor inside (for example, `2^()`), or wraps selected text in `^(...)`; percentage inserts `%`. Square root inserts `sqrt()` with the cursor inside, or wraps selected text in `sqrt(...)`. The input help lists the syntax and shows `10% = 10/100`. Percentage means division by 100: `200*10% = 20`, while `200+10% = 200.1`. All operations are evaluated by Go. For example, `sqrt(16)+2^3+50%` returns `12.5`.

At the end of an expression, keypad operator buttons replace incompatible or repeated trailing operators: `2+` then Divide becomes `2/`. Minus can follow multiplication, division, and bare power for negative operands; repeated Percentage stays a single `%`. Power substitution applies only to a bare trailing `^` after its parentheses are deleted. The complete substitution table and examples are in the [frontend guide](docs/FRONTEND.md#trailing-operator-keypad-substitution).

After an opening parenthesis, keypad entry allows digits, Square root, Minus, nested parentheses, or Decimal (inserting `0.`), and ignores other operators or an empty closing parenthesis. This also guards the inside of `sqrt()` and `^()` and preserves a pending negative sign. Digit clicks after `)` or `%` insert multiplication: `(2+3)` then `4` becomes `(2+3)*4`, and `50%` then `2` becomes `50%*2`. The rules use cursor context, including whitespace, and preserve surrounding text. Keyboard typing, pasting, and selected-text replacement retain their existing behavior; see [keypad context rules](docs/FRONTEND.md#parentheses-guards-and-multiplication-before-digits).

Screenshots: [desktop](docs/screenshots/desktop.png) · [320px mobile](docs/screenshots/mobile.png).

![Calculator desktop preview](docs/screenshots/desktop.png)

## Run with Docker

The [Docker implementation](PLAN.md#docker-implementation) uses two containers: Nginx serving the built React app, and the Go API on a private Compose network. Nginx forwards `/api/` and `/health` to Go, so the browser uses one address. Compose services can reach each other by name on the default network. See [Docker's networking documentation](https://docs.docker.com/compose/how-tos/networking/).

**Verified on 2026-10-27:** images build from source and both services pass their health checks on Docker Desktop 4.97.0 / Engine 29.9.2 / Compose 5.6.1 (Linux ARM64). The Go tests and all 163 frontend tests also pass inside the Linux build stages. Published base-image manifests support AMD64 as well; execution on AMD64 was not tested.

### Prerequisites

- A running Docker engine with Docker Compose v2 or newer supporting `--wait` (for example, Docker Desktop).
- Internet access for the initial image pulls and npm installation.
- Host port `8081` available, or use the override below. Go and Node do not need to be installed on the host.

On macOS, if Docker Desktop is installed but `docker` is not on your shell's PATH, enable its CLI tools in Docker Desktop or add them for the current terminal:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
```

### Build and start both apps

From the repository root:

```bash
docker compose config
docker compose up --build --wait --wait-timeout 60
```

`--wait` runs the services in the background and waits for readiness; health checks cover the backend HTTP endpoint and frontend static serving. Frontend startup waits for a healthy backend. See [Docker's command reference](https://docs.docker.com/reference/cli/docker/compose/up/).

Open [the containerized calculator](http://127.0.0.1:8081). Only this frontend/proxy port is published; backend port `8080` stays inside the Compose network. The existing local Go server on host port `8080` can remain running.

### Check the running services

```bash
docker compose ps
curl -i http://127.0.0.1:8081/health
curl -i http://127.0.0.1:8081/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"sqrt(16)+2^(3)+50%"}'
```

Expected: health returns HTTP `200` with `{"status":"ok"}`, and the calculation returns HTTP `200` with `{"result":12.5}`. Both requests pass through Nginx to Go. The API examples below use port `8080` for the ordinary local workflow; use `8081` for the Docker workflow.

View logs from both apps (Ctrl+C exits log viewing without stopping the services):

```bash
docker compose logs -f frontend backend
```

### Change the browser port

The `CALCULATOR_HTTP_PORT` setting changes only the host port:

```bash
CALCULATOR_HTTP_PORT=9090 docker compose up --build --wait --wait-timeout 60
```

Then open [the calculator on port 9090](http://127.0.0.1:9090) and use port `9090` for curl checks. No `.env` file is required. Use the same override on subsequent `up` commands to retain the chosen port.

### Rebuild or stop

This workflow packages built assets; source changes require a rebuild. For hot reload, use the local Go/Vite workflow instead.

```bash
docker compose up --build --wait --wait-timeout 60
```

Stop and remove this project's containers and Compose network:

```bash
docker compose down
```

The setup stores no application data or persistent volumes. Stopping it does not stop the Go/Vite processes started outside Docker.

### Container design and verification

- [Backend Dockerfile](backend/Dockerfile): Go `1.26.10-alpine3.24` build stage, statically linked executable, and Alpine `3.24.0` runtime as UID 10001. This toolchain satisfies the module's Go 1.25 minimum without changing `go.mod`.
- [Frontend Dockerfile](frontend/Dockerfile): Node `24.21.0-alpine3.24`, lockfile installation with `npm ci`, TypeScript/Vite build, and Nginx `1.30.6-alpine3.24` runtime as its `nginx` user (UID 101).
- [Nginx configuration](frontend/nginx.conf): serves static assets and preserves API paths, query strings, JSON errors, and status codes. Go retains the 4096-byte body limit. Runtime files use writable temporary paths; logs go to stdout/stderr.
- [Compose configuration](compose.yaml): private backend port, localhost-only frontend publication, HTTP health checks, and ten-second shutdown grace periods. Each app has a `.dockerignore` excluding local build output, dependencies, coverage, and environment files.

Verification included 20 HTTP checks on each of ports 8081 and 9090 (HTML/assets, health, arithmetic, positioned errors, malformed input, body limits, and API 404/405 responses), a browser calculation returning `12.5`, non-root process checks, and successful cleanup/restart. Go handled SIGTERM and exited with code 0. Nginx recovered after the backend was recreated with a different internal IP. Runtime verification was on Linux ARM64.

An image build runs the application builds, but does not run unit tests automatically. To repeat the unit tests in the same Linux build environments:

```bash
docker build --target build -t calculator-backend-build-check ./backend
docker run --rm --network none -e CGO_ENABLED=0 calculator-backend-build-check go test ./...
docker build --target build -t calculator-frontend-build-check ./frontend
docker run --rm --network none calculator-frontend-build-check npm test -- --run
```

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

Positions are zero-based code-point offsets in the original expression. Domain errors, including `sqrt(-1)`, `0^0`, and `(-2)^0.5`, return `422 INVALID_ARGUMENT`. Syntax and schema errors return `400`; oversized bodies return `413`; unsupported Content-Type returns `415`. Unsupported methods return `405` with an `Allow` header, and unknown paths return `404`.

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

Verified on Go 1.25.4: `go test -race ./... -coverprofile=coverage.out`, `go vet ./...`, and the standalone build pass. Statement coverage is **89.8% overall**, **99.4% for the calculator package**, and **95.5% for HTTP**. The server entry point/lifecycle is checked separately over HTTP rather than included in unit-test coverage.

The latest five-second fuzz run completed **525,169 executions** without failures. A live test against the updated backend verified health, twelve calculations (including all new operations), seven positioned errors, and clean SIGTERM shutdown. The frontend was subsequently checked against the real backend in a browser; see frontend verification below.

To repeat the short fuzz check from `backend/`:

```bash
go test ./internal/calculator -run='^$' -fuzz=FuzzEvaluate -fuzztime=5s -parallel=2
```

To build a standalone executable from `backend/`:

```bash
go build -o bin/calculator ./cmd/server
./bin/calculator
```

## Frontend checks and build

From the repository root:

```bash
cd frontend
npm run test:coverage
npm run typecheck
npm run build
```

All **163 tests pass**, with **98.69% statement coverage**, **95.48% branch coverage**, and **100% line/function coverage** across application/client code. Coverage includes untested source files, excluding tests, test setup, and the bootstrap entry point. HTML and LCOV reports are generated in `frontend/coverage/` and ignored by Git.

Tests exercise the actual API client with controlled fetch responses: request shape, finite results, malformed responses, errors/positions, connectivity and timeout behavior. Component tests cover Enter submission, empty/overlong input (including after template insertion), pending state, Clear, keypad editing, square-root wrapping and cursor placement, the full operator-substitution matrix, negative operands, opening-parenthesis guards, multiplication before digit keys after `)`/`%`, template preservation, exact advanced-operation requests, domain-error selection, retry, and stale-output clearing. These unit tests do not substitute for real HTTP verification.

Browser verification used Vite with the real Go backend: precedence, parentheses, division-by-zero feedback, Clear, and recovery after deliberately stopping/restarting the backend. The advanced controls were subsequently verified through real API requests for `2^3^2`, `sqrt(9)`, `200*10%`, and `sqrt(-1)`, including selection wrapping. Desktop and 320px mobile layouts were visually checked; the mobile page has no horizontal overflow and keypad buttons remain 52px tall. Screenshots are linked above. Loading and timeout behavior also have automated coverage.

`npm run build` checks TypeScript and writes the production frontend to `frontend/dist/`. Production hosting must serve those static files and route `/api` to Go on the same origin; the Vite development server is not a production deployment. Typography loads from Google Fonts with local sans-serif fallbacks.

## Remaining delivery work

Publish the repository and coverage artifacts for evaluation. The optional arithmetic operations and their frontend controls/help are implemented. Docker packaging and local container verification are complete; the containers have not been deployed to an external host.

## Design decisions and assumptions

- Each frontend component imports its own CSS Module. Shared fonts, theme variables, resets, and accessibility utilities remain in `frontend/src/styles.css`; responsive rules live with the component they affect.

- The server entry point owns configuration, HTTP timeouts, signals, and shutdown; `internal/httpapi` constructs routes independently of a listener for testing.
- Go owns arithmetic. A separate tokenizer/parser/evaluator accepts only the documented arithmetic grammar. The parser builds a tree before arithmetic begins, so syntax errors take priority over division errors.
- One expression field supports multiple operators and parentheses. Go enforces full validation; React checks presence/length and shows server errors with positions; it never evaluates arithmetic locally.
- Binary floating-point can produce decimal rounding artifacts; the application is not intended for exact financial arithmetic.
- Calculations are stateless; no accounts or database are required.
- Docker Compose runs the built React app behind Nginx and keeps Go as a separate service. Both runtimes use non-root users; builders and host dependencies are excluded from the runtime images. Nginx resolves the backend through Docker DNS to recover after container recreation.

## Submission status

- Backend and frontend implementation, tests, build, and local browser integration: complete.
- Git repository: initialized locally; publication and evaluator access: pending.
- Repository URL: pending.
- Prompt record: [PROMPT_LOG.md](PROMPT_LOG.md); append prompts used in subsequent work and other AI tools.
