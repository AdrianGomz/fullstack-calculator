# Calculator API — proposed contract

Status: design specification only; not implemented or tested. Expression input and parentheses are user-approved. Detailed grammar and limits below are proposed implementation rules.

## Endpoint and request

`POST /api/v1/calculate`

Development backend URL: `http://localhost:8080`. No authentication or persistence is planned. Requests and responses use JSON. Require `Content-Type: application/json` (an optional charset parameter is allowed).

```json
{
  "expression": "2+3+5/4"
}
```

Require exactly one JSON object with one required, non-null string field, `expression`. Reject unknown fields and trailing JSON. This replaces the earlier operation/operands design; there is no compatibility mode because it was never implemented. One expression produces one result; this is not a batch of independent calculations.

## Grammar and precedence

```text
expression = term { ("+" | "-") term }
term       = unary { ("*" | "/") unary }
unary      = { "+" | "-" } primary
primary    = number | "(" expression ")"
number     = digits [ "." [ digits ] ] | "." digits
digits     = digit { digit }
digit      = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
```

Braces denote repetition; brackets denote optional syntax. Require full consumption of the input after skipping permitted whitespace.

- Accept ASCII digits, operators `+ - * /`, and parentheses `(` and `)`.
- Ignore ASCII spaces, tabs, carriage returns, and line feeds between tokens. Whitespace cannot split a number: `1 2` and `1 .5` are invalid.
- Accept decimals such as `12`, `12.5`, `.5`, and `5.`, including leading zeros. Scientific notation, commas, and non-ASCII digits are outside the initial grammar.
- Parentheses override normal precedence and may nest.
- Unary signs bind more tightly than multiplication/division. Chained signs are allowed: `--2` is `2`, `2--3` is `5`, and `-(2+3)` is `-5`.
- Multiplication/division bind more tightly than addition/subtraction. Equal-precedence binary operators evaluate left to right: `8/4*2` is `4`; `10-3-2` is `5`.
- Multiplication must be explicit: `2(3+4)` and `(2)(3)` are invalid.
- Reject empty input, empty/unmatched parentheses, missing operators/operands, identifiers, functions, exponentiation, percentage, and any other unsupported syntax.

## Parser architecture and limits

Use a Go tokenizer and recursive-descent parser to build a small expression tree, then evaluate it. Parse the entire input before arithmetic so syntax errors consistently take priority: `1/0+` is invalid syntax. Preserve token/operator source positions. Evaluate binary children left to right and stop on the first arithmetic error.

Use loops for operator chains and unary signs; bound parenthesis recursion explicitly. Never invoke a general-purpose code evaluator or shell.

- Request body: at most 4096 bytes (4 KiB).
- Decoded expression: at most 256 Unicode code points, including whitespace. Check length before grammar validation; only the ASCII grammar is accepted.
- Parenthesis nesting: at most 32 pairs deep. Reject the opening parenthesis that would create depth 33. Sequential pairs do not increase nesting depth.

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

## Errors

Use a stable error code and a readable message:

```json
{
  "error": {
    "code": "INVALID_EXPRESSION",
    "message": "Expected a number or '(' after '+'.",
    "position": 2
  }
}
```

This example describes `2+`: position `2` is end of input. Positions are zero-based Unicode code-point offsets in the original decoded expression, including whitespace. End of input is its length. The frontend must use the same indexing convention for highlighting, including when unsupported Unicode characters are present.

Include positions for syntax, numeric-literal, nesting-limit, and arithmetic errors. Point to the offending token/operator, unexpected closing parenthesis, or end of input for a missing token/closing parenthesis. An expression-length error points to `256`, the first excess character. Omit positions for HTTP/JSON/schema errors because they do not refer to the decoded expression.

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | Empty/malformed JSON, missing or unknown fields, null/non-string expression, non-object body, or trailing JSON. |
| `400` | `INVALID_EXPRESSION` | Empty/whitespace-only expression, unsupported tokens, or invalid syntax/parentheses. |
| `400` | `EXPRESSION_TOO_LONG` | Expression exceeds 256 code points. |
| `400` | `EXPRESSION_TOO_DEEP` | Parenthesis nesting exceeds 32. |
| `422` | `NUMBER_OUT_OF_RANGE` | A syntactically valid numeric literal cannot be represented as a finite float64. |
| `422` | `DIVISION_BY_ZERO` | Division by positive, negative, or computed zero; position identifies `/`. |
| `422` | `NON_FINITE_RESULT` | Non-finite intermediate/final arithmetic result; position identifies the operator. |
| `405` | `METHOD_NOT_ALLOWED` | Different method at the calculation endpoint; include `Allow: POST`. |
| `413` | `REQUEST_TOO_LARGE` | Body exceeds 4096 bytes. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Missing/unsupported request Content-Type. |
| `404` | `NOT_FOUND` | Unknown API path. |
| `500` | `INTERNAL_ERROR` | Unexpected server failure; do not expose internal details. |

Validation order: method, content type, bounded body reading, JSON/schema checks, expression length, tokenization/parsing with nesting checks, numeric conversion, then evaluation. Complete syntax validation before numeric range checks; report the first out-of-range literal in source order before evaluating arithmetic. Numeric range guards are defensive under the restricted grammar/length limit and should also be unit-tested directly at the conversion/evaluator boundary.

## Example calls

These are expected behaviors after implementation, not executed service checks.

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

Also test malformed JSON/schema, unsupported characters, whitespace-only input, defensive numeric range checks, long unary chains, and both sides of the length/depth boundaries.

## Frontend integration

Use one expression field and submit its original value without trimming or rewriting, so error positions match what the user sees. Validate presence and code-point length locally; Go owns full parsing and arithmetic. Use the relative `/api/v1/calculate` URL through the development proxy.

Check HTTP status, validate that successful results are numeric and finite, display server messages/positions, and handle unreachable servers or invalid responses with a readable fallback. No automatic retries are necessary; allow resubmission after a failure.
