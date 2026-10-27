// Package httpapi exposes the calculator service's HTTP endpoints.
package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"

	"calculator/backend/internal/calculator"
)

type errorResponse struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Position *int   `json:"position,omitempty"`
}

// NewHandler constructs the routes without starting a network listener.
func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/api/v1/calculate", calculate)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Endpoint not found.")
	})
	return mux
}

func health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Use GET for this endpoint.")
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Status string `json:"status"`
	}{Status: "ok"})
}

func calculate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Use POST for this endpoint.")
		return
	}

	expression, ok := readCalculationRequest(w, r)
	if !ok {
		return
	}
	result, err := calculator.Evaluate(expression)
	if err != nil {
		writeCalculationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Result float64 `json:"result"`
	}{Result: result})
}

// readCalculationRequest writes the error response itself when validation fails.
func readCalculationRequest(w http.ResponseWriter, r *http.Request) (string, bool) {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		writeError(w, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.")
		return "", false
	}
	reader := http.MaxBytesReader(w, r.Body, 4096)
	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		var limitError *http.MaxBytesError
		if errors.As(err, &limitError) {
			writeError(w, http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE", "Request body exceeds 4096 bytes.")
		} else {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Could not read request body.")
		}
		return "", false
	}
	expression, err := decodeExpression(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Expected one JSON object with one string field named expression.")
		return "", false
	}
	return expression, true
}

func writeCalculationError(w http.ResponseWriter, err error) {
	var calculationError *calculator.Error
	if !errors.As(err, &calculationError) {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not calculate expression.")
		return
	}
	status := http.StatusBadRequest
	switch calculationError.Code {
	case calculator.DivisionByZero, calculator.NumberOutOfRange, calculator.NonFiniteResult, calculator.InvalidArgument:
		status = http.StatusUnprocessableEntity
	}
	writeJSON(w, status, errorResponse{Error: apiError{
		Code: calculationError.Code, Message: calculationError.Message, Position: &calculationError.Position,
	}})
}

// Decode tokens explicitly to reject duplicate keys and case variants as well
// as unknown fields, nulls, non-object bodies, and trailing JSON values.
func decodeExpression(body []byte) (string, error) {
	decoder := json.NewDecoder(bytes.NewReader(body))
	invalid := errors.New("invalid calculation request")
	opening, err := decoder.Token()
	if err != nil || opening != json.Delim('{') {
		return "", invalid
	}
	key, err := decoder.Token()
	if err != nil || key != "expression" {
		return "", invalid
	}
	var expression *string
	if err := decoder.Decode(&expression); err != nil || expression == nil {
		return "", invalid
	}
	closing, err := decoder.Token()
	if err != nil || closing != json.Delim('}') {
		return "", invalid
	}
	if _, err := decoder.Token(); err != io.EOF {
		return "", invalid
	}
	return *expression, nil
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Error: apiError{Code: code, Message: message}})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("writing JSON response", "error", err)
	}
}
