package client

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// familyClient returns an http.Client whose dialer forces network ("tcp4"|"tcp6"),
// choosing which of the host's dual-stack records to connect over.
func familyClient(network string, timeout time.Duration) *http.Client {
	d := &net.Dialer{Timeout: timeout}
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, addr string) (net.Conn, error) {
				return d.DialContext(ctx, network, addr)
			},
		},
	}
}

// parseRegisteredIP pulls the IP out of "Registered <ip> for 24h" / "Unregistered <ip>".
func parseRegisteredIP(body string) (string, error) {
	f := strings.Fields(body)
	if len(f) < 2 {
		return "", errors.New("unexpected worker response: " + strings.TrimSpace(body))
	}
	return f[1], nil
}

// registerOne issues POST|DELETE /register over the client's forced family with
// the CF Access token, returning the IP the worker reported.
func registerOne(ctx context.Context, c *http.Client, registerURL, token, method string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, method, registerURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Cf-Access-Token", token)
	resp, err := c.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", errors.New(strings.TrimSpace(string(body)))
	}
	return parseRegisteredIP(string(body))
}
