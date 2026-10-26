package main

import "testing"

func TestServerAddress(t *testing.T) {
	for _, tc := range []struct {
		name string
		port string
		want string
	}{
		{"default", "", ":8080"},
		{"custom", "9090", ":9090"},
		{"lowest", "1", ":1"},
		{"highest", "65535", ":65535"},
		{"leading zeros", "09090", ":9090"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := serverAddress(tc.port)
			if err != nil || got != tc.want {
				t.Fatalf("serverAddress(%q) = %q, %v; want %q, nil", tc.port, got, err, tc.want)
			}
		})
	}

	for _, port := range []string{"0", "-1", "65536", "8080.5", "abc", " 8080", "+8080", "999999999999999999999999"} {
		t.Run("invalid "+port, func(t *testing.T) {
			if _, err := serverAddress(port); err == nil {
				t.Fatalf("serverAddress(%q) accepted an invalid port", port)
			}
		})
	}
}
