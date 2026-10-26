package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRoutes(t *testing.T) {
	handler := NewHandler()
	for _, tc := range []struct {
		name   string
		method string
		path   string
		status int
		code   string
		allow  string
	}{
		{"health", http.MethodGet, "/health", http.StatusOK, "", ""},
		{"health wrong method", http.MethodPost, "/health", http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "GET"},
		{"calculation placeholder", http.MethodPost, "/api/v1/calculate", http.StatusNotImplemented, "NOT_IMPLEMENTED", ""},
		{"calculation wrong method", http.MethodGet, "/api/v1/calculate", http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST"},
		{"unknown endpoint", http.MethodGet, "/missing", http.StatusNotFound, "NOT_FOUND", ""},
		{"health subpath", http.MethodGet, "/health/extra", http.StatusNotFound, "NOT_FOUND", ""},
		{"calculation subpath", http.MethodPost, "/api/v1/calculate/extra", http.StatusNotFound, "NOT_FOUND", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{"expression":"(2+3)*4"}`))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status = %d; want %d", response.Code, tc.status)
			}
			if got := response.Header().Get("Content-Type"); got != "application/json" {
				t.Fatalf("Content-Type = %q; want application/json", got)
			}
			if got := response.Header().Get("Allow"); got != tc.allow {
				t.Fatalf("Allow = %q; want %q", got, tc.allow)
			}

			if tc.code == "" {
				var body struct {
					Status string `json:"status"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Status != "ok" {
					t.Fatalf("health response = %s; decode error = %v", response.Body, err)
				}
				return
			}
			var body errorResponse
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatalf("invalid JSON response: %v", err)
			}
			if body.Error.Code != tc.code || body.Error.Message == "" {
				t.Fatalf("error = %+v; want code %q and a message", body.Error, tc.code)
			}
		})
	}
}
