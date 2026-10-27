# Frontend implementation and review guide

This document explains the current implementation so its behavior and design choices can be reviewed before further changes. The React frontend is already implemented; the alternatives listed here are review options, not changes that have been made.

## Responsibility and boundaries

The frontend lets a user edit an expression, submit it, and understand the result or error. Go owns parsing, precedence, parentheses, and arithmetic. React sends the displayed expression unchanged and never calculates a result locally.

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
| [Calculator.tsx](../frontend/src/components/Calculator.tsx) | Coordinates the editor hook, result/error/pending state, positioned API feedback, validation, and submission. |
| [ExpressionInput.tsx](../frontend/src/components/ExpressionInput.tsx) | Renders the controlled field/help/count and maps keyboard, paste/drop, and browser input events to editing actions. |
| [ResultPanel.tsx](../frontend/src/components/ResultPanel.tsx) | Displays result/loading/error feedback and readable error positions. |
| [Keypad.tsx](../frontend/src/components/Keypad.tsx) | Renders accessible keys, forwards editing actions, and submits the containing form through the equals button. |
| [operatorSubstitution.ts](../frontend/src/utils/operatorSubstitution.ts) | Pure helper that identifies the trailing operator range to replace during keypad editing. |
| [operatorSubstitution.test.ts](../frontend/src/utils/operatorSubstitution.test.ts) | Tests the substitution matrix, negative operands, and boundaries of the editing rule. |
| [keypadContext.ts](../frontend/src/utils/keypadContext.ts) | Pure helper for empty-group guards and multiplication before digits after `)`/`%` or roots/groups after numbers. |
| [keypadContext.test.ts](../frontend/src/utils/keypadContext.test.ts) | Tests cursor context, whitespace, template guards, and the boundaries of automatic multiplication. |
| [useExpressionEditor.ts](../frontend/src/hooks/useExpressionEditor.ts) | Owns local expression state and cursor snapshots, restores selection, and guards browser input changes. |
| [expressionEditing.ts](../frontend/src/utils/expressionEditing.ts) | Pure shared key actions, literal insertion/character validation, and changed-span detection. |
| [expressionEditing.test.ts](../frontend/src/utils/expressionEditing.test.ts) | Tests character restrictions, literal paste, deletion, and changed spans. |
| [Keyboard.test.tsx](../frontend/src/Keyboard.test.tsx) | Tests physical-keyboard/keypad parity, clipboard rules, native controls, browser input fallbacks, and pending-state protection. |
| [calculator.ts](../frontend/src/api/calculator.ts) | Makes HTTP requests, validates responses, translates errors, and enforces a timeout. |
| [styles.css](../frontend/src/styles.css) | Shared font imports, CSS variables, resets, focus/disabled behavior, reduced-motion support, and `sr-only`. |
| [App.module.css](../frontend/src/App.module.css) | Page shell, centering, header/wordmark/footer, and their responsive rules. |
| [Calculator.module.css](../frontend/src/components/Calculator.module.css) | Calculator card, heading, keyboard hint, and mobile card padding. |
| [ExpressionInput.module.css](../frontend/src/components/ExpressionInput.module.css) | Scoped input/focus/error appearance, label, count, and help text. |
| [ResultPanel.module.css](../frontend/src/components/ResultPanel.module.css) | Result/loading/error presentation and error-state variants. |
| [Keypad.module.css](../frontend/src/components/Keypad.module.css) | Grid, key variants, interaction styles, and the two-column equals key. |
| [vite.config.ts](../frontend/vite.config.ts) | Configures React, the development API proxy, and Vitest/coverage. |
| [App.test.tsx](../frontend/src/App.test.tsx) | Tests form behavior and interactions. |
| [calculator.test.ts](../frontend/src/api/calculator.test.ts) | Tests API request/response handling and failures. |

## State model

All calculator state is local to `Calculator` and its `useExpressionEditor` hook; nothing is persisted across reloads. `App` owns only page layout. The input, result panel, and keypad receive their data and callbacks through typed props.

| Value | Meaning | Initial value |
| --- | --- | --- |
| `expression` | The exact displayed expression, including generated square-root calls. | `"0"` |
| `result` | Last successful numeric result; `null` means no result. | `null` |
| `error` | A `CalculationError` containing a message and optional position. | `null` |
| `pending` | Whether a request is in progress; drives disabled/loading UI. | `false` |

`result !== null` is checked explicitly so a valid answer of zero is displayed.

The coordinator uses two refs: `input` points to the native input for selection/focus; `inFlight` is an immediate duplicate-submission guard. Unlike a state update, changing that guard does not wait for React to render. The editor also keeps the latest value and selection restoration flag in refs so rapid keys use current state. It does not keep undo/redo history.

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

Enter, a typed `=`, and the `=` button submit the same native form. A typed `=` calls `requestSubmit()` and is not inserted into the expression. There are no separate calculation paths for keyboard and mouse.

At submission, the frontend checks:

1. The expression is not empty or whitespace-only.
2. Its length is at most 256 Unicode code points, including whitespace.

The whitespace check uses a trimmed copy, but the submitted value is not trimmed. Go remains responsible for the complete grammar and all arithmetic/domain checks. This avoids maintaining two parsers with potentially different behavior.

During a request, the input and keypad are disabled. The result area shows “Working…”. A `finally` block clears the pending state and duplicate-submission guard after success or failure.

Editing the expression clears the previous result and error, so an answer never appears to belong to newly edited input.

## Keypad and editing behavior

The keypad is an input aid. It does not call the API except when `=` submits the form.

- The expression starts at `0`; Clear restores `0` and removes the result/error. On this lone zero, number and parenthesis keys replace it, operators retain it (for example, `0+`), and the decimal key produces `0.`. Square root replaces it with `sqrt()`. Physical-keyboard entry uses the same starting-zero rule. Square-root calls can be created through the button or lowercase `s`. An accepted paste replaces a lone zero and otherwise replaces the current selection or inserts at the cursor. Zeros within longer expressions are preserved.
- Otherwise, numbers, operators, decimal points, and parentheses insert at the input cursor or replace selected text, subject to the keypad context and trailing-operator rules below.
- The visible `×`, `÷`, and `−` buttons insert the API grammar's `*`, `/`, and `-` characters.
- The keypad includes three advanced controls: Power (`xʸ`) inserts a balanced `^()` template, Square root (`√`) inserts a balanced `sqrt()` template, and Percentage inserts `%`. Accessible names are “Power”, “Square root”, and “Percentage”.
- With no selection, Power and Square root place the cursor inside the new parentheses. With a selection, they wrap the selected text in `^(...)` or `sqrt(...)` and place the cursor after the closing parenthesis. For example, Power after `2` produces `2^()`, ready to enter the exponent. Surrounding text is preserved. With a collapsed selection, Square root after a number or `)` inserts multiplication before the template; selection wrapping retains its existing behavior.
- Backspace removes selected text or the previous whole Unicode code point.
- Clear resets the expression to `0`, clears the result and error, and focuses the input with the cursor after zero. Backspace and manual deletion can still leave an empty field, which is validated on submission.
- The editor restores the cursor synchronously and again in `useLayoutEffect` after React renders, so fast typing uses the correct insertion point without waiting for an animation frame.

### Physical keyboard, clipboard, and browser input

Physical keys and keypad buttons call the same `editExpression` function. Typed `^` inserts `^()` with the cursor inside, `2+/` becomes `2/`, and `(2)` followed by `4` becomes `(2)*4`. Existing context/selection rules apply equally to both sources.

New expression text is restricted to ASCII digits and `+ - * / ^ % ( ) .`. Lowercase `s` is a command, not literal expression text: it performs the same action as Square root, inserting `sqrt()` with the cursor inside or wrapping selected text in `sqrt(...)` with the cursor after the closing parenthesis. It also works inside parentheses and nested roots. Other letters (including uppercase `S`), spaces, scientific notation, and unsupported symbols are ignored. Use `s` or the Square root button, then edit the argument using numbers and operators. Validation checks newly inserted text rather than rejecting the existing function letters.

Paste and plain-text drop are atomic: if any character is forbidden, the entire insertion is rejected with the expression, selection, and result/error feedback preserved. This includes pasted `sqrt(...)`, `√`, whitespace, and `=`. Accepted arithmetic text is inserted literally. Pasting `2^3+4` keeps that expression and its precedence; it does not replay the typed power-template action. Go validates the resulting complete expression, so literal paste may still produce a syntax error.

Enter and a typed `=` calculate, and lowercase `s` invokes Square root. Arrow/Home/End navigation, Tab, selection, copy, cut, and paste remain available. Backspace and Delete use shared deletion actions; modified word-deletion remains browser-driven. Ctrl/Cmd shortcuts, including Ctrl/Cmd+S, are not intercepted: there is no custom undo/redo shortcut or history. The submitted expression stays in the field after success, and all editing remains disabled during a pending request.

`ExpressionInput` maps physical keys and paste/drop events to callbacks. A native `beforeinput` listener covers cancelable virtual-keyboard input. An `onChange` fallback compares the changed span for autofill, composition, cut, and non-cancelable input, validates new text, and restores rejected changes. Single-character typing uses shared key actions; bulk replacement is literal. The parent input ref is exposed through `useImperativeHandle` for positioned errors and focus. There are no global keyboard listeners or added dependencies.

### Parentheses guards and multiplication before digits

With no selected text, keypad clicks and physical-keyboard editing inspect the preceding non-whitespace character at the cursor. These rules work within an expression as well as at its end; text after the cursor is preserved.

- After `(`, allow digits, Square root, and Minus. Also allow another `(` for nested grouping, and make Decimal insert `0.`. Ignore Add, Multiply, Divide, Percentage, Power, and Close parenthesis while the group is empty.
- After a minus directly following `(`, continue expecting an operand. Repeating Minus keeps a single sign, Decimal inserts `0.`, and other arithmetic operators or Close parenthesis are ignored. Thus `(-` then Divide stays `(-`, instead of applying substitution and creating `(/`.
- Apply the same guards inside `sqrt()` and `^()`. The templates remain intact: Add inside `2^()` is ignored, while Minus produces `2^(-)` and a digit can then fill the exponent.
- After `)` or `%`, a digit key inserts `*` and the digit. `(2+3)` then `4` becomes `(2+3)*4`; `50%` then `2` becomes `50%*2`; `sqrt(9)` then `2` becomes `sqrt(9)*2`. Subsequent digits extend the number normally. The digit rule also applies after `%`. Root/group entry after a number or `)` follows the additional rule below.

After a number or `)`, Square root (the button or `s`) and Open parenthesis insert `*` first. `2` then Square root becomes `2*sqrt()` with the caret inside; `2` then `(` becomes `2*(`. Typing `2s9` produces `2*sqrt(9)`; typing `2(3+4)` produces `2*(3+4)`. After a completed group, `(2)s9` becomes `(2)*sqrt(9)` and `(2)(3+4)` becomes `(2)*(3+4)`. This also applies after completed square-root or power parentheses, such as `sqrt(9)` and `2^(3)`. Integers, negative numbers, decimals, and trailing decimal points (`5.`) are supported. The rule checks the prefix at the cursor and preserves the suffix, so inserting Square root after `2` in `2+3` produces `2*sqrt()+3`.

It does not add a duplicate `*` after an existing operator. The lone starting/cleared `0` still gets replaced by Square root or `(`. Selected-text wrapping/replacement and literal paste/drop remain unchanged; in particular, pasting `2(3+4)` stays literal and the updated backend evaluates it as `14` using implicit multiplication. Decimal insertion itself is not expanded into multiplication.

The context helper defensively ignores preceding whitespace, although the UI now rejects new whitespace. Literal paste/drop and selected-text editing do not apply context transformations. Backspace and Clear remain available. Ignored keys preserve the expression, result/error feedback, and caret, and return focus to the input; accepted edits clear stale feedback. Inserted characters count toward the existing 256-code-point limit.

`getContextualKey` returns either insertion text (for example, `*4` or `0.`), a template prefix such as `sqrt` or `*sqrt`, another unchanged action name, or `null` for an ignored key. The shared editing function checks this helper before operator substitution, then applies template and caret handling. Typed/keypad edits continue supplying explicit multiplication; the backend also accepts the documented implicit forms from literal pasted text. The request/response shape is unchanged.

### Trailing-operator keypad substitution

When the cursor is at the end of the expression with no text selected, a typed operator or operator button replaces the trailing operator according to this table. This prevents repeated operators and accidental pairs such as `+/`. Here, operands are numbers or subexpressions; operators are the arithmetic symbols.

| Existing trailing operator | Incoming keys that replace it |
| --- | --- |
| `+` | `+`, `-`, `*`, `/`, `%`, `^` |
| `-` | `-`, `+`, `*`, `/`, `%`, `^` |
| `*` | `*`, `+`, `/`, `%`, `^` |
| `/` | `/`, `+`, `*`, `%`, `^` |
| `%` | `%` only |
| Bare `^` | `^`, `+`, `*`, `/`, `%` |

For example, `2+` then Divide becomes `2/`; `2-` then Add becomes `2+`. An incoming minus replaces plus/minus, but follows multiplication, division, or bare power to allow a negative operand: `2*-`, `2/-`, or `2^-`. Repeating that unary minus keeps a single minus. Replacing an unfinished operation that already includes a unary minus replaces both symbols: `2*-` then Divide becomes `2/`, rather than `2*/`.

Percentage is postfix. Repeating Percentage leaves `50%`, while Add after `50%` appends normally to produce `50%+`. Power inserts its balanced template after substitution: `2+` then Power becomes `2^()` with the cursor inside.

The `^` row applies only to a bare trailing operator, such as `2^` after its parentheses are manually deleted. The `^()` template is excluded from substitution, including when the cursor is inside empty parentheses; the parentheses guard above applies there instead. Square root retains its insertion/wrapping behavior, so `2+` then Square root becomes `2+sqrt()`.

Literal paste/drop, selected-text replacement, and insertion within an expression do not apply this substitution rule. The trailing symbol must be at the literal end of the input; trailing whitespace retains normal insertion behavior. This is an editing aid, not a second parser: Go still validates the full submitted expression and reports any remaining syntax or arithmetic errors.

`getOperatorReplacementStart` returns a UTF-16 insertion offset. The shared editor uses that offset with its text/template insertion and caret restoration, and does not wrap a replaced operator as a selected exponent. The helper has no React or API dependency.

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

Centering is applied to `.shell > main` in `App.module.css`, so it does not depend on a class on the `<main>` element. Vite scopes the shell class automatically. The main area has 32px vertical padding on desktop and 24px on mobile; it expands to fill available space within the full-height page shell.

The keypad uses one four-column grid inside its disabled-capable fieldset. Its rows are:

1. `(`, `)`, `Clear`, `⌫`
2. `xʸ`, `√`, `%`, `÷`
3. `7`, `8`, `9`, `×`
4. `4`, `5`, `6`, `+`
5. `1`, `2`, `3`, `−`
6. `0`, `.`, `=` (equals spans the final two columns)

The equals key fills two column tracks plus the gap between them. Input help can wrap while the character counter stays on one line. The current percentage hint reads `10% = 10/100`; percentage semantics and additional examples are documented above.

Styling uses CSS Modules, imported by each matching TSX component as `styles`. Vite generates scoped class names, so similarly named classes such as `footer` do not collide across components. Element selectors that affect appearance are scoped beneath local classes; for example, input styles belong to ExpressionInput rather than a global `input` selector. Responsive rules live in the module that owns the affected element.

`styles.css` stays global for font imports, shared font/color variables, box sizing, base body/control behavior, focus/disabled styling, the `sr-only` utility, and reduced-motion preferences. Common theme values use CSS variables such as `--font-display`, `--color-muted`, and `--color-accent`. DM Sans and Manrope load from Google Fonts with local sans-serif fallbacks. Reduced-motion preferences disable CSS transitions. Desktop and 320px layouts were checked visually, with no horizontal overflow at 320px.

Review screenshots: [desktop](screenshots/desktop.png) and [mobile](screenshots/mobile.png). The latest captures (2026-10-26) show `sqrt(16)+2^3+50%` returning `12.5` from the running Go API, with the six-row keypad, wide equals button, and percentage guidance visible. Desktop was captured at 1280 × 1100 and mobile at a width of 320px; shorter viewports can scroll vertically.

## Development and deployment

Vite serves the frontend on `127.0.0.1:5173` and proxies `/api` to `127.0.0.1:8080`. `API_PROXY_TARGET` overrides the backend target. This keeps browser requests on one origin during development.

The production build outputs static assets to `frontend/dist/`. The Docker Compose workflow builds them in a Node stage and serves them through a non-root Nginx container on `127.0.0.1:8081`. Nginx routes `/api/` and `/health` to the Go service by its Compose name and resolves Docker DNS again after backend recreation. Browser requests remain relative; no frontend API-host setting or CORS change is needed. The Vite proxy is used only for local development. Container builds and integration are verified locally on Linux ARM64; external production deployment is not established. Run/build and Docker commands are in the [README](../README.md#run-with-docker).

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

`Calculator` owns API feedback/pending state and the input ref, and calls `useExpressionEditor` for local expression editing. `ExpressionInput` receives `inputRef`, `expression`, `pending`, `hasError`, `onKeyPress`, `onInsertText`, and `onNativeChange`. `ResultPanel` receives `result`, `pending`, an error message/optional position, and `expressionLength`; its error prop is a simple data shape rather than an API-client dependency. `Keypad` receives `pending` and `onKeyPress`. The equals key remains a native submit button, preserving the same path as pressing Enter in the input.

The children do not fetch results or maintain duplicate copies of expression/result state. The editor hook now separates browser/selection coordination from HTTP submission, and pure helpers share the rules between typing and clicking. A generic button component remains unnecessary. The existing App-level interaction tests exercise the complete composition, including refs and focus behavior.

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
| Component organization | Page shell, Calculator coordinator, editor hook, three presentation components, and API/pure editing modules | Add a generic button component if shared button behavior emerges |

## Verification and limits

The current implementation passes 277 client/component/helper tests, TypeScript checks, and the production build. Coverage is 96.69% of statements, 95.03% of branches, 98.55% of lines, and 100% of functions. Keyboard tests cover all operator pairs, allowed/forbidden characters, root-button/`s` parity, paste/drop rejection and precedence, cursor placement, native shortcuts, browser input fallbacks, equals submission, and pending-state protection. Context-editing tests cover allowed/blocked keys, preserved feedback, negative operands, decimal/nested grouping, templates, whitespace, explicit multiplication in submitted expressions, cursor/selection handling, and the length limit after insertion. The initial-zero and power-template changes add coverage for keyboard/keypad replacement, retained zero operands, reset behavior, exponent wrapping, and caret placement. Tests control fetch responses; separate manual browser checks used the real Go API for precedence, parentheses, division errors, Clear, and outage/recovery behavior.

The advanced-operation milestone passed all 37 tests and the TypeScript/production build. Browser checks confirmed power and percentage button submission, square-root template insertion and selection wrapping, domain-error feedback, the combined example result, desktop centering, no horizontal overflow at 320px, and visible mobile attribution. The screenshots reflect the current component-based implementation and header/footer copy.

Tested responsive widths were desktop and 320px. This does not establish support across every browser/device or a full screen-reader audit. The backend supports `^`, `sqrt(...)`, and postfix `%` through the same expression request, and the frontend now offers both typed entry and dedicated controls/help. Persistent history and production deployment remain outside the current implementation.


The CSS Modules refactor preserved the existing component tests: all 37 tests and the TypeScript/production build pass. Browser checks confirmed desktop centering, the two-column equals key, scoped input/error states, and the 320px layout with mobile padding and visible attribution. The app still submits the same expressions and receives the same backend results.

Keyboard validation was also verified in the rebuilt Docker app on 2026-10-27: real typing replaced trailing operators, ignored letters, added multiplication, and inserted power templates. An invalid paste preserved the selected expression; literal `2^3+4` returned `12`. Button-created `sqrt(9)` returned `3`, and typing `(2)4^2` produced `(2)*4^(2)` and returned `32`. All 222 tests pass in the Linux build stage. Virtual-keyboard/input fallback paths have automated coverage; this is not a full audit of every mobile keyboard or IME.

The number-to-root/group rule was verified on 2026-10-27 with all 261 tests passing locally and in the Linux build stage. Browser checks against the Docker/Go app confirmed `2s9` becomes `2*sqrt(9)` and returns `6`, while `2(3+4)` becomes `2*(3+4)` and returns `14`.

Closing-parenthesis extension (2026-10-27): root/group insertion after `)` is covered by helper, keyboard, keypad, caret/selection, and exact-request tests. All 275 local tests and TypeScript/production build pass. Docker testing for this extension is left to the user; the running image has not been rebuilt for it.

Backend implicit multiplication (2026-10-27): accepted pasted arithmetic text such as `4(3)` or `(2)(4)` is sent unchanged and supported by the updated Go parser. Typed/keypad automatic `*` insertion, `s`, character restrictions, selection behavior, and atomic paste rejection are unchanged. Two new request tests cover literal implicit forms; all 277 frontend tests and the production build pass locally. Docker verification remains with the user.
