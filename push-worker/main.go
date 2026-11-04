package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"math/rand/v2"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxAttempts = 8

type config struct {
	databaseURL, publicKey, privateKey, subject string
	encryptionKey                               []byte
}

func readConfig() (config, error) {
	c := config{databaseURL: os.Getenv("DATABASE_URL"), publicKey: os.Getenv("VAPID_PUBLIC_KEY"), privateKey: os.Getenv("VAPID_PRIVATE_KEY"), subject: os.Getenv("VAPID_SUBJECT")}
	encoded := strings.TrimSpace(os.Getenv("PUSH_SUBSCRIPTION_KEY"))
	key, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(encoded, "="))
	if err != nil || len(key) != 32 || c.databaseURL == "" || c.publicKey == "" || c.privateKey == "" || c.subject == "" {
		return c, errors.New("DATABASE_URL, PUSH_SUBSCRIPTION_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are required")
	}
	c.encryptionKey = key
	pub, pubErr := base64.RawURLEncoding.DecodeString(strings.TrimRight(c.publicKey, "="))
	priv, privErr := base64.RawURLEncoding.DecodeString(strings.TrimRight(c.privateKey, "="))
	curve := elliptic.P256()
	if pubErr != nil || privErr != nil || len(priv) != 32 {
		return c, errors.New("invalid VAPID key pair")
	}
	scalar := new(big.Int).SetBytes(priv)
	if scalar.Sign() <= 0 || scalar.Cmp(curve.Params().N) >= 0 {
		return c, errors.New("invalid VAPID key pair")
	}
	x, y := elliptic.Unmarshal(curve, pub)
	wantX, wantY := curve.ScalarBaseMult(priv)
	if x == nil || x.Cmp(wantX) != 0 || y.Cmp(wantY) != 0 {
		return c, errors.New("invalid VAPID key pair")
	}
	if !strings.HasPrefix(c.subject, "mailto:") && !strings.HasPrefix(c.subject, "https://") {
		return c, errors.New("VAPID_SUBJECT must be a mailto or HTTPS URL")
	}
	parsed, err := url.Parse(c.databaseURL)
	if err != nil {
		return c, errors.New("invalid database URL")
	}
	q := parsed.Query()
	q.Del("schema")
	parsed.RawQuery = q.Encode()
	c.databaseURL = parsed.String()
	return c, nil
}

func decryptMaterial(key []byte, encoded string) (*webpush.Subscription, error) {
	data, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil || len(data) < 28 {
		return nil, errors.New("invalid subscription material")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	plain, err := gcm.Open(nil, data[:gcm.NonceSize()], data[gcm.NonceSize():], nil)
	if err != nil {
		return nil, errors.New("subscription decryption failed")
	}
	var subscription webpush.Subscription
	if err := json.Unmarshal(plain, &subscription); err != nil {
		return nil, errors.New("invalid subscription material")
	}
	return &subscription, nil
}

func publicAddress(ip netip.Addr) bool {
	ip = ip.Unmap()
	if !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsMulticast() {
		return false
	}
	for _, cidr := range []string{"0.0.0.0/8", "100.64.0.0/10", "192.0.0.0/24", "192.0.2.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "240.0.0.0/4", "2001:db8::/32"} {
		if netip.MustParsePrefix(cidr).Contains(ip) {
			return false
		}
	}
	return true
}

func safeClient() *http.Client {
	transport := &http.Transport{Proxy: nil, DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil || port != "443" {
			return nil, errors.New("invalid push destination")
		}
		ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
		if err != nil || len(ips) == 0 {
			return nil, errors.New("push DNS failed")
		}
		for _, ip := range ips {
			if !publicAddress(ip) {
				return nil, errors.New("unsafe push destination")
			}
		}
		var dialer net.Dialer
		return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
	}}
	return &http.Client{Transport: transport, Timeout: 10 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
}

func validEndpoint(endpoint string) bool {
	u, err := url.Parse(endpoint)
	return err == nil && u.Scheme == "https" && u.Hostname() != "" && u.User == nil && u.Fragment == "" && (u.Port() == "" || u.Port() == "443")
}

func inQuietHours(now time.Time, zone string, start, end int32) (bool, error) {
	location, err := time.LoadLocation(zone)
	if err != nil {
		return false, err
	}
	hour := int32(now.In(location).Hour())
	if start < end {
		return hour >= start && hour < end, nil
	}
	return hour >= start || hour < end, nil
}

func deliverOne(ctx context.Context, pool *pgxpool.Pool, c config, client *http.Client) (bool, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	var id, subID, material, destination, eventType string
	var attempts int
	var enabled *bool
	var quietStart, quietEnd *int32
	var zone *string
	err = tx.QueryRow(ctx, `SELECT d.id, s.id, s.material_ciphertext, n.destination, d.attempts, n.event_type, p.bank_activity, p.quiet_start, p.quiet_end, p.timezone FROM notification_deliveries d JOIN push_subscriptions s ON s.id=d.subscription_id JOIN notifications n ON n.id=d.notification_id AND n.user_id=s.user_id LEFT JOIN notification_preferences p ON p.user_id=n.user_id WHERE d.status='pending' AND d.next_attempt_at <= now() AND s.enabled=true ORDER BY d.next_attempt_at FOR UPDATE OF d,s SKIP LOCKED LIMIT 1`).Scan(&id, &subID, &material, &destination, &attempts, &eventType, &enabled, &quietStart, &quietEnd, &zone)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	if eventType == "bank_activity" && enabled != nil && !*enabled {
		if _, err = tx.Exec(ctx, `UPDATE notification_deliveries SET status='cancelled', last_error='preference_disabled' WHERE id=$1`, id); err != nil {
			return false, err
		}
		return true, tx.Commit(ctx)
	}
	if eventType != "test" && quietStart != nil && quietEnd != nil && zone != nil {
		quiet, quietErr := inQuietHours(time.Now(), *zone, *quietStart, *quietEnd)
		if quietErr != nil {
			return false, errors.New("invalid preference timezone")
		}
		if quiet {
			if _, err = tx.Exec(ctx, `UPDATE notification_deliveries SET next_attempt_at=now()+interval '15 minutes' WHERE id=$1`, id); err != nil {
				return false, err
			}
			return true, tx.Commit(ctx)
		}
	}
	status, category := "pending", "temporary"
	sub, err := decryptMaterial(c.encryptionKey, material)
	if err != nil || !validEndpoint(sub.Endpoint) {
		status, category = "failed", "invalid_subscription"
	} else {
		payload, _ := json.Marshal(map[string]string{"destination": destination})
		response, sendErr := webpush.SendNotificationWithContext(ctx, payload, sub, &webpush.Options{HTTPClient: client, Subscriber: c.subject, VAPIDPublicKey: c.publicKey, VAPIDPrivateKey: c.privateKey, TTL: 3600})
		if sendErr == nil {
			response.Body.Close()
			switch {
			case response.StatusCode >= 200 && response.StatusCode < 300:
				status, category = "accepted", ""
			case response.StatusCode == 404 || response.StatusCode == 410:
				status, category = "failed", "expired"
				_, err = tx.Exec(ctx, `UPDATE push_subscriptions SET enabled=false WHERE id=$1`, subID)
				if err != nil {
					return false, err
				}
			case response.StatusCode == 429 || response.StatusCode >= 500:
				category = "temporary"
			default:
				status, category = "failed", "rejected"
			}
		}
	}
	attempts++
	if status == "pending" && attempts >= maxAttempts {
		status, category = "failed", "retry_exhausted"
	}
	delay := time.Duration(1<<min(attempts, 10))*time.Second + time.Duration(rand.IntN(1000))*time.Millisecond
	_, err = tx.Exec(ctx, `UPDATE notification_deliveries SET status=$2, attempts=$3, last_attempt_at=now(), next_attempt_at=now()+($4 * interval '1 second'), last_error=NULLIF($5,'') WHERE id=$1`, id, status, attempts, delay.Seconds(), category)
	if err != nil {
		return false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return false, err
	}
	log.Printf("delivery outcome=%s category=%s attempts=%d", status, category, attempts)
	return true, nil
}

func run(ctx context.Context) error {
	c, err := readConfig()
	if err != nil {
		return err
	}
	pool, err := pgxpool.New(ctx, c.databaseURL)
	if err != nil {
		return errors.New("database configuration invalid")
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return errors.New("database unavailable")
	}
	client := safeClient()
	for ctx.Err() == nil {
		processed, err := deliverOne(ctx, pool, c, client)
		if err != nil {
			log.Print("delivery processing failed")
			processed = false
		}
		if !processed {
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(2 * time.Second):
			}
		}
	}
	return nil
}

func main() {
	if len(os.Args) == 2 && os.Args[1] == "--generate-vapid" {
		private, public, err := webpush.GenerateVAPIDKeys()
		if err != nil {
			fmt.Fprintln(os.Stderr, "could not generate VAPID keys")
			os.Exit(1)
		}
		fmt.Printf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", public, private)
		return
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := run(ctx); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
