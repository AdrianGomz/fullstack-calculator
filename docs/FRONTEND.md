# Frontend implementation and review guide

This document explains the current implementation so its behavior and design choices can be reviewed before further changes. The React frontend is already implemented; the alternatives listed here are review options, not changes that have been made.

## Responsibility and boundaries

The frontend lets a user edit an expression, submit it, and understand the result or error. Go owns parsing, precedence, parentheses, and arithmetic. React sends the original input unchanged and never calculates a result locally.

For example, entering `2+3+5/4` sends:

```json
{"expression":"2+3+5/4"}
```

A successful response is:

```json
{"result":6.25}
```

The full request/error contract is in [API.md](API.md).

## File structure

| File | Responsibility |
| --- | --- |
| [main.tsx](../frontend/src/main.tsx) | Mounts React and imports CSS. Uses React StrictMode during development. |
| [App.tsx](../frontend/src/App.tsx) | Renders the header, main page layout, calculator, and footer. |
| [Calculator.tsx](../frontend/src/components/Calculator.tsx) | Owns expression/result/error/pending state, input focus/selection, validation, submission, and keypad editing. |
| [ExpressionInput.tsx](../frontend/src/components/ExpressionInput.tsx) | Renders the controlled expression field, label, help text, character count, and accessibility attributes. |
| [ResultPanel.tsx](../frontend/src/components/ResultPanel.tsx) | Displays result/loading/error feedback and readable error positions. |
| [Keypad.tsx](../frontend/src/components/Keypad.tsx) | Renders accessible keys, forwards editing actions, and submits the containing form through the equals button. |
| [calculator.ts](../frontend/src/api/calculator.ts) | Makes HTTP requests, validates responses, translates errors, and enforces a timeout. |
| [styles.css](../frontend/src/styles.css) | Defines colors, typography, layout, keypad appearance, focus styles, and responsive breakpoints. |
| [vite.config.ts](../frontend/vite.config.ts) | Configures React, the development API proxy, and Vitest/coverage. |
| [App.test.tsx](../frontend/src/App.test.tsx) | Tests form behavior and interactions. |
| [calculator.test.ts](../frontend/src/api/calculator.test.ts) | Tests API request/response handling and failures. |

## State model

All calculator state is local to `Calculator`; nothing is persisted across reloads. `App` owns only page layout. The input, result panel, and keypad receive their data and callbacks through typed props.

| Value | Meaning | Initial value |
| --- | --- | --- |
| `expression` | The exact text in the input, including spaces. | Empty string |
| `result` | Last successful numeric result; `null` means no result. | `null` |
| `error` | A `CalculationError` containing a message and optional position. | `null` |
| `pending` | Whether a request is in progress; drives disabled/loading UI. | `false` |

`result !== null` is checked explicitly so a valid answer of zero is displayed.

Two refs support interaction without being display state: `input` points to the native input for selection/focus; `inFlight` is an immediate duplicate-submission guard. Unlike a state update, changing that guard does not wait for React to render.

## Submission lifecycle

```mermaid
flowchart TD
    A[Enter or equals button] --> B[Clear previous result]
    B --> C{Nonempty and at most 256 code points?}
    C -- No --> D[Show local validation error]
    C -- Yes --> E[Disable editing and show loading]
    E --> F[POST original expression]
    F --> G{Valid success response?}
    G -- Yes --> H[Display numeric result]
    G -- No --> I[Display API or connection error]
    H --> J[Enable controls and focus input]
    I --> J
```

Both Enter in the input and the `=` button submit the same native form. There are no separate calculation paths for keyboard and mouse.

Before a request, the frontend checks only:

1. The expression is not empty or whitespace-only.
2. Its length is at most 256 Unicode code points, including whitespace.

The whitespace check uses a trimmed copy, but the submitted value is not trimmed. Go remains responsible for the complete grammar and all arithmetic/domain checks. This avoids maintaining two parsers with potentially different behavior.

During a request, the input and keypad are disabled. The result area shows “Working…”. A `finally` block clears the pending state and duplicate-submission guard after success or failure.

Editing the expression clears the previous result and error, so an answer never appears to belong to newly edited input.

## Keypad and editing behavior

The keypad is an input aid. It does not call the API except when `=` submits the form.

- Numbers, operators (including `^` and `%`), decimal points, and parentheses insert at the input cursor or replace selected text.
- The visible `×`, `÷`, and `−` buttons insert the API grammar's `*`, `/`, and `-` characters.
- The keypad includes three advanced controls: Power (`xʸ`) inserts `^`, Square root (`√`) inserts a balanced `sqrt()` template, and Percentage inserts `%`. Accessible names are “Power”, “Square root”, and “Percentage”.
- With no selection, Square root places the cursor inside the new parentheses. With a selection, it wraps the selected text in `sqrt(...)` and places the cursor after the closing parenthesis. Surrounding text is preserved; no multiplication is inferred.
- Backspace removes selected text or the previous whole Unicode code point.
- Clear empties the expression, result, and error, then focuses the input.
- After keypad editing, `requestAnimationFrame` restores the cursor after React has updated the controlled input.

Physical-keyboard entry uses the browser's normal input behavior. There are no global keyboard shortcuts, automatic multiplication, automatic bracket completion during typing, or automatic reuse of the previous answer. The balanced square-root template is an explicit keypad action. The submitted expression stays in the field after success.

## API client behavior

`calculate(expression): Promise<number>` is the boundary between UI and HTTP. It:

1. Sends `POST /api/v1/calculate` with JSON and the original expression.
2. Starts an `AbortController` timer lasting ten seconds, covering the request and response-body reading.
3. Parses the JSON as unknown runtime data rather than trusting a TypeScript type.
4. Accepts success only when `result` is a finite number.
5. Converts server and transport failures into `CalculationError` objects.
6. Clears the timer when the request finishes. Requests are not retried automatically.

| Situation | Current UI behavior |
| --- | --- |
| Structured API error | Display the server's nonempty message and valid optional position. |
| Error position is malformed or outside the input | Ignore the position; retain the message. |
| Error response has no usable message | Display a generic request-failure message. |
| Failed HTTP response is not JSON, such as a proxy error | Display a service-unavailable message. |
| Successful HTTP response is not JSON | Display an unreadable-response message. |
| Success result is missing, nonnumeric, or non-finite | Display an invalid-result message. |
| Fetch fails to connect | Display a connection message with a backend-startup hint. |
| Ten-second timeout | Abort and display a timeout message. |

The client currently uses the server message and position, not its error code, to drive presentation. Adding different UI actions for particular error codes would require retaining those codes in `CalculationError`.

## Error positions and accessibility

The API reports zero-based code-point offsets. The UI shows a one-based position: API position `2` appears as “Check position 3.” If it points past the final character, the message identifies the end of the expression.

For `10/(3-3)`, the API identifies `/` at offset `2`. The UI focuses the input and selects that character. Native browser selections use UTF-16 offsets, so the UI converts the API offset before selecting. This matters when an invalid Unicode character occupies more than one UTF-16 unit.

The form has an associated input label, linked syntax/percentage/error help text, `aria-invalid`, and `aria-busy`. Results use a polite live region; errors use an alert. Keypad buttons have names such as “Multiply” and “Open parenthesis”. Keyboard focus styles are visible, and focus returns to the input after a result or error. These are implemented accessibility provisions, not a claim of a complete assistive-technology audit.

## Visual design and responsiveness

The current appearance is an implementation choice: a warm neutral background, dark green result panel, and terracotta equals button. The calculator is centered horizontally and vertically within the space between the header and footer, with a maximum width of 470px. The page can scroll when the content exceeds the viewport height. At widths up to 760px, page/card padding is reduced; additional page-padding rules apply at 1000px. The removed introduction and example controls have no remaining styles or tests.

The header combines a boxed lowercase `c` with `alculator.` using a 2px gap. It contains no tagline. The header has an 80px minimum height on desktop and 72px on mobile. The calculator card heading contains only decorative operator symbols, followed by the labeled expression input. The footer displays “By: Isaac Gomez Ocon.” at all widths.

Centering is applied to `.app-shell > main`, so it does not depend on a class on the `<main>` element. The main area has 32px vertical padding on desktop and 24px on mobile; it expands to fill available space within the full-height page shell.

The keypad uses one four-column grid inside its disabled-capable fieldset. Its rows are:

1. `xʸ`, `√`, `Clear`, `⌫`
2. `(`, `)`, `%`, `÷`
3. `7`, `8`, `9`, `×`
4. `4`, `5`, `6`, `+`
5. `1`, `2`, `3`, `−`
6. `0`, `.`, `=` (equals spans the final two columns)

The equals key fills two column tracks plus the gap between them. Input help can wrap while the character counter stays on one line. Percentage guidance explains `10% = 0.1`, `200 × 10% = 20`, and `200 + 10% = 200.1`.

Styling uses plain CSS. DM Sans and Manrope load from Google Fonts with local sans-serif fallbacks. Reduced-motion preferences disable CSS transitions. Desktop and 320px layouts were checked visually, with no horizontal overflow at 320px.

Review screenshots: [desktop](screenshots/desktop.png) and [mobile](screenshots/mobile.png). The latest captures (2026-10-26) show `sqrt(16)+2^3+50%` returning `12.5` from the running Go API, with the six-row keypad, wide equals button, and percentage guidance visible. Desktop was captured at 1280 × 1100 and mobile at a width of 320px; shorter viewports can scroll vertically.

## Development and deployment

Vite serves the frontend on `127.0.0.1:5173` and proxies `/api` to `127.0.0.1:8080`. `API_PROXY_TARGET` overrides the backend target. This keeps browser requests on one origin during development.

The production build outputs static assets to `frontend/dist/`. Production hosting still needs to serve those assets and route `/api` to Go; local integration does not establish a deployed production setup. Run/build commands are in the [README](../README.md).

## Patterns and tradeoffs

The implementation uses a **controlled form**, **local React state**, and a separate **API client module**. It does not require a global state manager or a frontend copy of the backend Interpreter pattern.

The component hierarchy separates page layout, calculator coordination, and presentation:

```text
App
└── Calculator
    ├── ExpressionInput
    ├── ResultPanel
    └── Keypad
```

`Calculator` owns shared state and the input ref. `ExpressionInput` receives `inputRef`, `expression`, `pending`, `hasError`, and `onChange`. `ResultPanel` receives `result`, `pending`, an error message/optional position, and `expressionLength`; its error prop is a simple data shape rather than an API-client dependency. `Keypad` receives `pending` and `onKeyPress`. The equals key remains a native submit button, preserving the same path as pressing Enter in the input.

The children do not fetch results or maintain duplicate copies of expression/result state. A custom hook or generic button component is unnecessary for the current scope; either can be introduced later if shared behavior emerges. The existing App-level interaction tests exercise the complete composition, including refs and focus behavior.

## Choices to review before further changes

| Choice | Current behavior | Possible alternative |
| --- | --- | --- |
| Page layout | Centered calculator with header/footer | Adjust card width or simplify the surrounding header/footer |
| Input controls | Free-text expression and keypad | Keyboard-first form with fewer buttons |
| Submission | Explicit Enter or `=` | Debounced live calculation, with cancellation/stale-response handling |
| Pending requests | Disable editing until completion | Allow edits; cancel/ignore superseded requests |
| Result formatting | `String(result)`, preserving normal floating-point artifacts | Rounded display with a separately accessible precise value |
| Next calculation | Original expression remains in the field | Replace input with the answer or offer an explicit “Use result” action |
| Error feedback | Server message, position, and selected character | Inline annotated expression or field-specific guidance |
| Appearance | Current colors, typography, and calculator copy | Different theme, copy, or self-hosted fonts |
| Component organization | Page shell, Calculator coordinator, three presentation components, and a separate API module | Extract a state hook if the same behavior is reused elsewhere |

## Verification and limits

The last implementation run passed 37 client/component tests, TypeScript checks, and the production build. Reported statement coverage was 98.05%, with 93.51% branch coverage. Tests control fetch responses; separate manual browser checks used the real Go API for precedence, parentheses, division errors, Clear, and outage/recovery behavior.

The advanced-operation milestone passed all 37 tests and the TypeScript/production build. Browser checks confirmed power and percentage button submission, square-root template insertion and selection wrapping, domain-error feedback, the combined example result, desktop centering, no horizontal overflow at 320px, and visible mobile attribution. The screenshots reflect the current component-based implementation and header/footer copy.

Tested responsive widths were desktop and 320px. This does not establish support across every browser/device or a full screen-reader audit. The backend supports `^`, `sqrt(...)`, and postfix `%` through the same expression request, and the frontend now offers both typed entry and dedicated controls/help. Persistent history and production deployment remain outside the current implementation.
