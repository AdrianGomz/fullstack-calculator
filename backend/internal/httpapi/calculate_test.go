package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCalculate(t *testing.T) {
	jsonBody := func(expression string) string {
		body, err := json.Marshal(map[string]string{"expression": expression})
		if err != nil {
			t.Fatal(err)
		}
		return string(body)
	}
	base := jsonBody("1")
	cases := []struct {
		name, body, contentType string
		status                  int
		result                  float64
		code                    string
		position                int // -1 means the field must be absent.
	}{
		{"precedence", jsonBody("2+3+5/4"), "application/json", 200, 6.25, "", -1},
		{"parentheses", jsonBody("(2+3+5)/4"), "application/json", 200, 2.5, "", -1},
		{"zero", jsonBody("-0"), "application/json", 200, 0, "", -1},
		{"charset", base, "application/json; charset=utf-8", 200, 1, "", -1},
		{"whitespace around JSON", " \n" + base + "\t ", "application/json", 200, 1, "", -1},
		{"missing content type", base, "", 415, 0, "UNSUPPORTED_MEDIA_TYPE", -1},
		{"wrong content type", base, "text/plain", 415, 0, "UNSUPPORTED_MEDIA_TYPE", -1},
		{"bad content type", base, "application/json; broken", 415, 0, "UNSUPPORTED_MEDIA_TYPE", -1},
		{"empty body", "", "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"malformed", "{", "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"null body", "null", "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"array body", "[]", "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"missing field", "{}", "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"null expression", `{"expression":null}`, "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"numeric expression", `{"expression":2}`, "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"object expression", `{"expression":{}}`, "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"unknown field", `{"expression":"2","extra":1}`, "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"case variant", `{"Expression":"2"}`, "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"duplicate field", `{"expression":"1","expression":"2"}`, "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"previous shape", `{"operation":"add","operands":[2,3]}`, "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"trailing JSON", base + " {}", "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"trailing junk", base + " !", "application/json", 400, 0, "INVALID_REQUEST", -1},
		{"empty expression", jsonBody(""), "application/json", 400, 0, "INVALID_EXPRESSION", 0},
		{"whitespace expression", jsonBody("  "), "application/json", 400, 0, "INVALID_EXPRESSION", 2},
		{"syntax before arithmetic", jsonBody("1/0+"), "application/json", 400, 0, "INVALID_EXPRESSION", 4},
		{"unclosed parenthesis", jsonBody("(2+3"), "application/json", 400, 0, "INVALID_EXPRESSION", 4},
		{"division by zero", jsonBody("10/(3-3)"), "application/json", 422, 0, "DIVISION_BY_ZERO", 2},
		{"max expression", jsonBody("1" + strings.Repeat(" ", 255)), "application/json", 200, 1, "", -1},
		{"long expression", jsonBody(strings.Repeat("1", 257)), "application/json", 400, 0, "EXPRESSION_TOO_LONG", 256},
		{"Unicode", jsonBody("1+💡"), "application/json", 400, 0, "INVALID_EXPRESSION", 2},
		{"too deep", jsonBody(strings.Repeat("(", 33) + "1" + strings.Repeat(")", 33)), "application/json", 400, 0, "EXPRESSION_TOO_DEEP", 32},
		{"exact body limit", base + strings.Repeat(" ", 4096-len(base)), "application/json", 200, 1, "", -1},
		{"body too large", base + strings.Repeat(" ", 4097-len(base)), "application/json", 413, 0, "REQUEST_TOO_LARGE", -1},
		{"oversize malformed", strings.Repeat("!", 4097), "application/json", 413, 0, "REQUEST_TOO_LARGE", -1},
	}
	handler := NewHandler()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(tc.body))
			request.Header.Set("Content-Type", tc.contentType)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status=%d want=%d body=%s", response.Code, tc.status, response.Body)
			}
			if response.Header().Get("Content-Type") != "application/json" {
				t.Fatal("response is not JSON")
			}
			if tc.code == "" {
				var body struct {
					Result *float64 `json:"result"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if body.Result == nil || *body.Result != tc.result {
					t.Fatalf("got %s; want result %v", response.Body, tc.result)
				}
				return
			}
			var body errorResponse
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Error.Code != tc.code || body.Error.Message == "" {
				t.Fatalf("got %+v; want %s", body, tc.code)
			}
			if tc.position < 0 {
				if body.Error.Position != nil {
					t.Fatal("unexpected position")
				}
			} else if body.Error.Position == nil || *body.Error.Position != tc.position {
				t.Fatalf("got %s; want position %d", response.Body, tc.position)
			}
		})
	}
}

type failingReader struct{}

func (failingReader) Read([]byte) (int, error) { return 0, errors.New("connection interrupted") }
func TestCalculateBodyReadFailure(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", nil)
	request.Body = io.NopCloser(failingReader{})
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	NewHandler().ServeHTTP(response, request)
	if response.Code != 400 || !strings.Contains(response.Body.String(), "INVALID_REQUEST") {
		t.Fatalf("got %d %s", response.Code, response.Body)
	}
}
