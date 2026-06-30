package client

import (
	"errors"
	"os"
	"os/exec"
	"strings"
)

// CloudflaredToken fetches a CF Access JWT for appOrigin. On a miss it triggers
// a browser login and retries once. Requires `cloudflared` on PATH.
func CloudflaredToken(appOrigin string) (string, error) {
	if tok, err := runToken(appOrigin); err == nil && tok != "" {
		return tok, nil
	}
	login := exec.Command("cloudflared", loginArgs(appOrigin)...)
	login.Stdout, login.Stderr = os.Stderr, os.Stderr
	if err := login.Run(); err != nil {
		return "", errors.New("cloudflared access login failed: " + err.Error())
	}
	tok, err := runToken(appOrigin)
	if err != nil {
		return "", err
	}
	if tok == "" {
		return "", errors.New("empty token from cloudflared after login")
	}
	return tok, nil
}

// loginArgs builds the `cloudflared access login` invocation. --quiet is
// load-bearing: without it cloudflared writes the fetched JWT to stdout, and
// since we wire login's stdout to our stderr (to surface the browser URL),
// the token would be echoed to the user's terminal. The browser-open and URL
// prompt run in cloudflared's token package before the quiet check, so login
// stays interactive. We re-read the token via runToken afterwards.
func loginArgs(appOrigin string) []string {
	return []string{"access", "login", "--app=" + appOrigin, "--quiet"}
}

func runToken(appOrigin string) (string, error) {
	out, err := exec.Command("cloudflared", "access", "token", "--app="+appOrigin).Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
