package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/jackc/pgx/v5/pgxpool"
)

type responseTransport struct {
	code  int
	calls int
}

func (r *responseTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	r.calls++
	return &http.Response{StatusCode: r.code, Body: io.NopCloser(strings.NewReader("")), Header: make(http.Header), Request: req}, nil
}

func TestDeliveryWithPostgres(t *testing.T) {
	url := os.Getenv("PUSH_WORKER_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("PUSH_WORKER_TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	userID := "push-worker-integration-test"
	_, err = pool.Exec(ctx, `INSERT INTO "User" (id,username,"hashedPassword","isAdmin","mustChangePassword","createdAt","updatedAt") VALUES ($1,$1,'test',false,false,now(),now())`, userID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = pool.Exec(context.Background(), `DELETE FROM "User" WHERE id=$1`, userID) }()
	private, public, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	clientKey, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	key := make([]byte, 32)
	subscription := webpush.Subscription{Endpoint: "https://example.com/push", Keys: webpush.Keys{P256dh: base64.RawURLEncoding.EncodeToString(clientKey.PublicKey().Bytes()), Auth: base64.RawURLEncoding.EncodeToString(make([]byte, 16))}}
	plain, _ := json.Marshal(subscription)
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize())
	ciphertext := base64.URLEncoding.EncodeToString(gcm.Seal(nonce, nonce, plain, nil))
	_, err = pool.Exec(ctx, `INSERT INTO push_subscriptions (id,user_id,endpoint_hash,material_ciphertext,device_name,enabled,created_at,updated_at,last_seen_at) VALUES ('test-sub',$1,'test-hash',$2,'Test',true,now(),now(),now())`, userID, ciphertext)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO notifications (id,user_id,event_type,event_key,title,body,destination,created_at) VALUES ('test-notification',$1,'bank_activity','test-event','Ledger','Review','/cashflow',now())`, userID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `INSERT INTO notification_deliveries (id,notification_id,subscription_id,status,attempts,next_attempt_at,created_at) VALUES ('test-delivery','test-notification','test-sub','pending',0,now(),now())`)
	if err != nil {
		t.Fatal(err)
	}
	transport := &responseTransport{code: http.StatusGone}
	processed, err := deliverOne(ctx, pool, config{publicKey: public, privateKey: private, subject: "mailto:test@example.com", encryptionKey: key}, &http.Client{Transport: transport, Timeout: 5 * time.Second})
	if err != nil || !processed || transport.calls != 1 {
		t.Fatalf("delivery failed: processed=%t calls=%d error=%v", processed, transport.calls, err)
	}
	var status string
	var enabled bool
	if err := pool.QueryRow(ctx, `SELECT d.status,s.enabled FROM notification_deliveries d JOIN push_subscriptions s ON s.id=d.subscription_id WHERE d.id='test-delivery'`).Scan(&status, &enabled); err != nil {
		t.Fatal(err)
	}
	if status != "failed" || enabled {
		t.Fatalf("expired subscription not disabled: status=%s enabled=%t", status, enabled)
	}

	_, err = pool.Exec(ctx, `UPDATE push_subscriptions SET enabled=true WHERE id='test-sub'; UPDATE notification_deliveries SET status='pending', attempts=0, next_attempt_at=now() WHERE id='test-delivery'`)
	if err != nil {
		t.Fatal(err)
	}
	transport.code = http.StatusServiceUnavailable
	processed, err = deliverOne(ctx, pool, config{publicKey: public, privateKey: private, subject: "mailto:test@example.com", encryptionKey: key}, &http.Client{Transport: transport})
	if err != nil || !processed {
		t.Fatalf("transient delivery failed: %v", err)
	}
	var attempts int
	if err := pool.QueryRow(ctx, `SELECT status, attempts FROM notification_deliveries WHERE id='test-delivery'`).Scan(&status, &attempts); err != nil {
		t.Fatal(err)
	}
	if status != "pending" || attempts != 1 {
		t.Fatalf("temporary failure was not queued for retry: %s %d", status, attempts)
	}
	_, err = pool.Exec(ctx, `UPDATE notification_deliveries SET next_attempt_at=now() WHERE id='test-delivery'`)
	if err != nil {
		t.Fatal(err)
	}
	transport.code = http.StatusCreated
	processed, err = deliverOne(ctx, pool, config{publicKey: public, privateKey: private, subject: "mailto:test@example.com", encryptionKey: key}, &http.Client{Transport: transport})
	if err != nil || !processed {
		t.Fatalf("successful retry failed: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT status FROM notification_deliveries WHERE id='test-delivery'`).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "accepted" {
		t.Fatalf("push service acceptance was not recorded: %s", status)
	}
}
