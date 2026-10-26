# Calculator API

Status: implemented and verified with unit tests and live HTTP checks. Expression input, precedence, parentheses, powers, square roots, postfix percentages, request validation, and the limits below are supported.

## Currently available endpoints

- `GET /health`: HTTP `200`, `{"status":"ok"}`; checks that the HTTP service is running.
- `POST /api/v1/calculate`: HTTP `200` with `{"result":...}` on success; structured JSON errors on failure.
- Other methods at these routes: HTTP `405` with `Allow: GET` or `Allow: POST`.
- Unknown endpoint paths: HTTP `404` with the `NOT_FOUND` JSON error.

These endpoint responses use `Content-Type: application/json`.

## Endpoint and request

`POST /api/v1/calculate`

Development backend URL: `http://localhost:8080`. No authentication or persistence is planned. Requests and responses use JSON. Require `Content-Type: application/json` (an optional charset parameter is allowed).

```json
{
  "expression": "2+3+5/4"
}
```

Require exactly one JSON object with one required, non-null string field, `expression`. Reject unknown fields, duplicate fields, case variants such as `Expression`, and trailing JSON. One expression produces one result; this is not a batch of independent calculations.

## Grammar and precedence

```text
expression = term { ("+" | "-") term }
term       = unary { ("*" | "/") unary }
unary      = { "+" | "-" } power
power      = postfix [ "^" unary ]
postfix    = primary [ "%" ]
primary    = number | "(" expression ")" | "sqrt" "(" expression ")"
number     = digits [ "." [ digits ] ] | "." digits
digits     = digit { digit }
digit      = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
```

Braces denote repetition; brackets denote optional syntax. Require full consumption of the input after skipping permitted whitespace.

- Accept ASCII digits, operators `+ - * / ^`, postfix `%`, parentheses, and the exact lowercase function name `sqrt`.
- Ignore ASCII spaces, tabs, carriage returns, and line feeds between tokens. Whitespace cannot split a number: `1 2` and `1 .5` are invalid.
- Accept decimals such as `12`, `12.5`, `.5`, and `5.`, including leading zeros. Scientific notation, commas, and non-ASCII digits are outside the initial grammar.
- Parentheses override normal precedence and may nest. `sqrt(expression)` accepts a complete expression and requires parentheses; `sqrt(4+5)` is `3`.
- Unary signs bind more tightly than multiplication/division. Chained signs are allowed: `--2` is `2`, `2--3` is `5`, and `-(2+3)` is `-5`.
- Multiplication/division bind more tightly than addition/subtraction. Equal-precedence binary operators evaluate left to right: `8/4*2` is `4`; `10-3-2` is `5`.
- Powers associate right to left: `2^3^2` is `2^(3^2)` = `512`. Power binds more tightly than leading signs: `-2^2` is `-4`, while `(-2)^2` is `4`. Signed exponents are allowed: `2^-3` is `0.125`.
- Postfix percentage converts its operand to a fraction by dividing by 100. It binds more tightly than power: `2^3%` is `2^(3/100)`, while `(2^3)%` is `0.08`. Accept one postfix `%`; reject `10%%`, but allow explicit nesting such as `(10%)%`.
- Percentage is context-independent: `200*10%` is `20`, `200+10%` is `200.1`, and increasing 200 by ten percent requires `200*(1+10%)`. `%` does not mean modulo.
- Multiplication must be explicit: `2(3+4)` and `(2)(3)` are invalid.
- Reject empty input, empty/unmatched parentheses, missing operators/operands, names/functions other than `sqrt`, alternate power syntax such as `**`, and any other unsupported syntax.

## Parser architecture and limits

Use a Go tokenizer and recursive-descent parser to build a small expression tree, then evaluate it. Parse the entire input before arithmetic so syntax errors consistently take priority: `1/0+` is invalid syntax. Preserve token/operator source positions. Evaluate binary children left to right and stop on the first arithmetic error.

Use loops for left-associative operator chains and unary signs; powers recurse to the right. Bound parenthesis recursion explicitly, including square-root arguments, and bound the remaining tree/recursion size through the 256-code-point input limit. Never invoke a general-purpose code evaluator or shell.

- Request body: at most 4096 bytes (4 KiB).
- Decoded expression: at most 256 Unicode code points, including whitespace. Check length before grammar validation; only the ASCII grammar is accepted.
- Parenthesis nesting: at most 32 pairs deep, counting both ordinary groups and square-root argument parentheses. Reject the opening parenthesis that would create depth 33. Sequential pairs do not increase nesting depth.

The backend enforces all limits independently of frontend validation.

## Success and numeric behavior

Return HTTP `200` with `Content-Type: application/json`:

```json
{
  "result": 6.25
}
```

Use finite IEEE 754 double-precision numbers. Return the result without arbitrary decimal rounding. `0.1+0.2` may yield `0.30000000000000004`; this is not an exact financial calculator. Normalize a final negative-zero result to zero. Reject non-finite numeric literals and intermediate/final results. Underflow follows `float64` behavior and may produce zero.

Reject divisors exactly equal to zero, including negative zero and zero produced by a subexpression. Do not use an epsilon that rejects small valid divisors.

Square root requires a nonnegative argument. Negative power bases require integer exponents; fractional exponents on a negative base are rejected even when a mathematical real root could exist for a particular rational exponent. `0^0` and zero raised to a negative exponent are explicitly rejected. These domain errors return `INVALID_ARGUMENT`; power overflow such as `2^1024` returns `NON_FINITE_RESULT`. Existing floating-point precision and underflow behavior also apply to the new operations.

## Errors

Use a stable error code and a readable message:

```json
{
  "error": {
    "code": "INVALID_EXPRESSION",
    "message": "Expected a number, '(', or sqrt(...).",
    "position": 2
  }
}
```

This example describes `2+`: position `2` is end of input. Positions are zero-based Unicode code-point offsets in the original decoded expression, including whitespace. End of input is its length. The frontend must use the same indexing convention for highlighting, including when unsupported Unicode characters are present.

Include positions for syntax, numeric-literal, nesting-limit, and arithmetic errors. Point to the offending token/operator, unexpected closing parenthesis, or end of input for a missing token/closing parenthesis. An expression-length error points to `256`, the first excess character. Omit positions for HTTP/JSON/schema errors because they do not refer to the decoded expression.

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | Empty/malformed JSON, missing/unknown/duplicate fields, case variants, null/non-string expression, non-object body, or trailing JSON. |
| `400` | `INVALID_EXPRESSION` | Empty/whitespace-only expression, unsupported tokens, or invalid syntax/parentheses. |
| `400` | `EXPRESSION_TOO_LONG` | Expression exceeds 256 code points. |
| `400` | `EXPRESSION_TOO_DEEP` | Parenthesis nesting exceeds 32. |
| `422` | `NUMBER_OUT_OF_RANGE` | A syntactically valid numeric literal cannot be represented as a finite float64. |
| `422` | `INVALID_ARGUMENT` | Negative square-root argument, negative power base with noninteger exponent, `0^0`, or zero raised to a negative exponent; position identifies `sqrt` or `^`. |
| `422` | `DIVISION_BY_ZERO` | Division by positive, negative, or computed zero; position identifies `/`. |
| `422` | `NON_FINITE_RESULT` | Non-finite intermediate/final arithmetic result; position identifies the operator. |
| `405` | `METHOD_NOT_ALLOWED` | Different method at the calculation endpoint; include `Allow: POST`. |
| `413` | `REQUEST_TOO_LARGE` | Body exceeds 4096 bytes. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Missing/unsupported request Content-Type. |
| `404` | `NOT_FOUND` | Unknown API path. |
| `500` | `INTERNAL_ERROR` | Unexpected server failure; do not expose internal details. |

Validation order: method, content type, bounded body reading, JSON/schema checks, expression length, tokenization/parsing with nesting checks, numeric conversion, then evaluation. Complete syntax validation before numeric range checks; report the first out-of-range literal in source order before evaluating arithmetic. Literal range guards are defensive under the decimal grammar/length limit and are also tested at the conversion boundary. Arithmetic overflow is reachable through power expressions and is tested through the public API.

## Example calls

These examples were verified against the built backend over HTTP.

Mixed operations — expected `200`, `{"result":6.25}`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"2+3+5/4"}'
```

Parentheses — expected `200`, `{"result":2.5}`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"(2+3+5)/4"}'
```

Computed zero divisor — expected `422`, `DIVISION_BY_ZERO`, position `2`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"10/(3-3)"}'
```

Missing closing parenthesis — expected `400`, `INVALID_EXPRESSION`, position `4`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"(2+3"}'
```

Combined operations — expected `200`, `{"result":12.5}`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"sqrt(16)+2^3+50%"}'
```

Invalid square root — expected `422`, `INVALID_ARGUMENT`, position `0`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"sqrt(-1)"}'
```

## Acceptance examples

| Expression | Expected result or error |
| --- | --- |
| `2+3+5/4` | `6.25` |
| `(2+3+5)/4` | `2.5` |
| `2*(3+(4/2))` | `10` |
| `8/4*2` | `4` |
| `10-3-2` | `5` |
| `-(2+3)*4` | `-20` |
| `2*-3` | `-6` |
| `2--3` | `5` |
| `--2` | `2` |
| ` .5 + 5. ` | `5.5` |
| `0` | `0` |
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
| `sqrt(-1)` | `INVALID_ARGUMENT`, position `0` |
| `(-2)^0.5` | `INVALID_ARGUMENT`, position `4` |
| `0^0`, `0^-1` | `INVALID_ARGUMENT`, position `1` |
| `2^1024` | `NON_FINITE_RESULT`, position `1` |
| `sqrt(4)+` | `INVALID_EXPRESSION`, position `8` |
| `10%%` | `INVALID_EXPRESSION`, position `3` |
| `()` | `INVALID_EXPRESSION`, position `1` |
| `(2+3` | `INVALID_EXPRESSION`, position `4` |
| `2+3)` | `INVALID_EXPRESSION`, position `3` |
| `2(3+4)` | `INVALID_EXPRESSION`, position `1` |
| `2+` | `INVALID_EXPRESSION`, position `2` |
| `2**3` | `INVALID_EXPRESSION`, position `2` |
| `1 2` | `INVALID_EXPRESSION`, position `2` |
| `1/0+` | `INVALID_EXPRESSION`, position `4` |
| `10/(3-3)` | `DIVISION_BY_ZERO`, position `2` |
| `1/-0` | `DIVISION_BY_ZERO`, position `1` |

Also test malformed JSON/schema, unsupported characters, whitespace-only input, defensive numeric range checks, long unary/power chains, mixed square-root/group nesting, and both sides of the length/depth boundaries.

## Frontend integration

Use one expression field and submit its original value without trimming or rewriting, so error positions match what the user sees. Validate presence and code-point length locally; Go owns full parsing and arithmetic. Use the relative `/api/v1/calculate` URL through the development proxy.

Check HTTP status, validate that successful results are numeric and finite, display server messages/positions, and handle unreachable servers or invalid responses with a readable fallback. No automatic retries are necessary; allow resubmission after a failure.
