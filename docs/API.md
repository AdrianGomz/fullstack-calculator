# Calculator API — proposed contract

Status: design specification only. The service has not been implemented or tested. This document is the contract to implement and update when design choices change.

## Endpoint

`POST /api/v1/calculate`

Development backend URL: `http://localhost:8080`. No authentication or persistence is planned for this assignment. Requests and responses use JSON; requests must have `Content-Type: application/json` (an optional charset parameter is allowed).

```json
{
  "operation": "add",
  "operands": [12.5, 7.5]
}
```

| Operation | Operand count | Meaning |
| --- | --- | --- |
| `add` | 2 | First operand + second operand |
| `subtract` | 2 | First operand − second operand |
| `multiply` | 2 | First operand × second operand |
| `divide` | 2 | First operand ÷ second operand |

Names are case-sensitive. Optional operations are not part of the initial API; reject them until implemented and documented.

## Success

Return HTTP `200` with `Content-Type: application/json`:

```json
{
  "result": 20
}
```

Use finite IEEE 754 double-precision numbers. Return the calculated value without rounding to an arbitrary number of decimal places. This means `0.1 + 0.2` may yield `0.30000000000000004`; the application is not intended for exact financial arithmetic. Normalize a negative-zero result to zero for display consistency. Reject non-finite inputs or results, including overflow, before JSON encoding.

## Validation and errors

Return a consistent JSON error shape; the frontend can display the safe message and use the stable code for logic:

```json
{
  "error": {
    "code": "DIVISION_BY_ZERO",
    "message": "Cannot divide by zero."
  }
}
```

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | Empty/malformed body, missing or unknown fields, incorrect types, nulls, trailing JSON, or non-finite/unrepresentable input numbers. |
| `400` | `UNSUPPORTED_OPERATION` | A string operation outside the supported set. |
| `400` | `INVALID_OPERANDS` | A numeric operands array with an incorrect number of elements. |
| `422` | `DIVISION_BY_ZERO` | Division by positive or negative zero. |
| `422` | `NON_FINITE_RESULT` | Calculation overflows or otherwise cannot produce a finite real result. |
| `405` | `METHOD_NOT_ALLOWED` | A different HTTP method at the calculation endpoint; include `Allow: POST`. |
| `413` | `REQUEST_TOO_LARGE` | Request body exceeds 4 KiB. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Missing or unsupported request Content-Type. |
| `404` | `NOT_FOUND` | Unknown API path. |
| `500` | `INTERNAL_ERROR` | Unexpected server failure; do not expose internal error details. |

Validation order for the endpoint: method, content type, bounded body decoding/schema checks, supported operation, operand count, arithmetic domain/result checks. The decoder must require exactly one JSON object and reject unknown fields. Ensure JSON `null` cannot silently decode into numeric zero. A divisor exactly equal to zero is invalid; do not invent an epsilon that rejects small but valid divisors.

## Example calls

These examples describe expected behavior after implementation; they have not been executed against a service.

Addition — expected `200`, `{"result":20}`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","operands":[12.5,7.5]}'
```

Subtraction — expected `200`, `{"result":-3}`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"subtract","operands":[2,5]}'
```

Division by zero — expected `422`, error code `DIVISION_BY_ZERO`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"divide","operands":[10,0]}'
```

Invalid data — expected `400`, error code `INVALID_REQUEST`:

```bash
curl -i http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","operands":["two",3]}'
```

## Frontend integration

Use a relative `/api/v1/calculate` URL through the development proxy. The API client must check the HTTP status, parse successful and error responses, and handle unreachable servers or invalid responses with a readable fallback message. A TypeScript type alone does not validate runtime JSON: check that a successful result is numeric and finite. No automatic retries are necessary for this interactive form; allow the user to submit again after a failure.
