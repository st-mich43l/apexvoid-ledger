package main

import (
	"encoding/base64"
	"net/netip"
	"testing"
	"time"
)

func TestUnsafeNetworkAddresses(t *testing.T) {
	for _, value := range []string{"127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "2001:db8::1"} {
		if publicAddress(netip.MustParseAddr(value)) {
			t.Errorf("unsafe IP accepted: %s", value)
		}
	}
	if !publicAddress(netip.MustParseAddr("8.8.8.8")) {
		t.Fatal("public IPv4 rejected")
	}
}

func TestQuietHoursAcrossMidnight(t *testing.T) {
	for _, tc := range []struct {
		hour int
		want bool
	}{{21, false}, {22, true}, {2, true}, {7, false}} {
		got, err := inQuietHours(time.Date(2026, 1, 1, tc.hour, 0, 0, 0, time.UTC), "UTC", 22, 7)
		if err != nil || got != tc.want {
			t.Errorf("hour %d: got %t, err %v", tc.hour, got, err)
		}
	}
}

func TestEndpointsAndCiphertext(t *testing.T) {
	for _, endpoint := range []string{"http://example.com/push", "https://user@example.com/push", "https://example.com:8443/push", "https://example.com/push#fragment"} {
		if validEndpoint(endpoint) {
			t.Errorf("invalid endpoint accepted: %s", endpoint)
		}
	}
	if !validEndpoint("https://example.com/push") {
		t.Fatal("valid HTTPS endpoint rejected")
	}
	_, err := decryptMaterial(make([]byte, 32), base64.URLEncoding.EncodeToString(make([]byte, 30)))
	if err == nil {
		t.Fatal("invalid ciphertext accepted")
	}
}

func TestDecryptPythonAESGCMFormat(t *testing.T) {
	const fixture = "AAAAAAAAAAAAAAAAtYUlUykQBAdpOufpmJvpbAITOeUYw1IVvNKZ61tlWuPyOsRbJWjNWSqNIFdlNk3VN3P-1-XTXQpDGWWCxnxWevLorRJU3EUVWrfJmCD8F8zZjTTN7Gm1HjtsZhWaxJiyesHjvg=="
	subscription, err := decryptMaterial(make([]byte, 32), fixture)
	if err != nil || subscription.Endpoint != "https://example.com/push" || subscription.Keys.Auth != "example" {
		t.Fatalf("cross-language decryption failed: %v", err)
	}
}
