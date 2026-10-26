# Full-stack calculator

A planned React + TypeScript frontend backed by a Go REST calculator service.

**Current status:** this repository folder contains planning documents only. The application, dependency manifests, tests, coverage reports, and deployment artifacts have not been created. Commands below are the intended workflow after implementation, not instructions for a runnable application today.

## Documentation

- [Implementation plan](PLAN.md): scope, architecture, milestones, testing, and delivery checklist.
- [API contract](docs/API.md): request/response formats, validation, errors, and examples.
- [Prompt log](PROMPT_LOG.md): user prompts supplied for this app.

## Planned setup and local development

Prerequisites: Node.js/npm, Go, and Git. Select supported versions at implementation time and record the exact tested versions here and in the relevant project configuration. No database, account, or external API credentials are planned.

Once code and manifests exist, install frontend dependencies from the committed lockfile:

```bash
cd frontend
npm ci
```

Run the backend in one terminal from the repository root:

```bash
cd backend
go run ./cmd/server
```

The planned backend listens on port `8080` by default; support a `PORT` environment variable override. Run the frontend in a second terminal from the repository root:

```bash
cd frontend
npm run dev
```

Configure the frontend development server at `http://localhost:5173` and proxy `/api` to `http://localhost:8080`. Update the proxy target if the backend port changes. Stop each server with Ctrl+C.

## Planned API usage

With the backend running:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"multiply","operands":[6,7]}'
```

Expected response: HTTP `200` and `{"result":42}`. The required operation names are `add`, `subtract`, `multiply`, and `divide`. See the [API contract](docs/API.md) for error examples and validation rules.

## Planned tests, coverage, and build

Backend, from the repository root:

```bash
cd backend
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out
go tool cover -html=coverage.out -o coverage.html
go vet ./...
```

Frontend, from the repository root:

```bash
cd frontend
npm run test -- --run
npm run test:coverage
npm run typecheck
npm run build
```

Define these frontend scripts during implementation using Vitest, React Testing Library, a compatible coverage provider, TypeScript, and Vite. Configure frontend coverage to include application source files, including untested files, and produce text and HTML reports in `frontend/coverage/`. Go coverage artifacts will be `backend/coverage.out` and `backend/coverage.html`.

Coverage results: **not measured yet**. Before submission, add the measured frontend and backend coverage summaries and provide reports as submission artifacts or CI artifacts. Do not treat a coverage percentage as a substitute for checking edge cases or running the frontend against the real backend.

## Design decisions and assumptions

- Go owns arithmetic; the React frontend validates user input and displays backend results.
- A pure calculation function is separate from HTTP decoding/encoding to simplify unit tests.
- One versioned calculation endpoint avoids duplicating validation and error behavior across four routes.
- Two operand fields and an operation selector avoid expression parsing and keep the UI within the time budget.
- Numbers use binary floating-point. Decimal rounding artifacts can occur; this is not an exact financial calculator.
- Calculations are stateless. Accounts, history persistence, and a database are outside the required scope.
- Optional advanced operations and Docker follow completion of the required features and documentation.

## Submission status

- Implementation and verification: pending.
- Git repository initialization and publication: pending.
- Repository URL: pending; record the actual accessible URL after pushing.
- Prompt record: [PROMPT_LOG.md](PROMPT_LOG.md); append prompts from later work and other AI tools before submission.

Before handoff, verify these setup commands from a fresh checkout and replace the planned status with actual results, supported versions, implemented features, and known limitations.
