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
	login := exec.Command("cloudflared", "access", "login", "--app="+appOrigin)
	login.Stdout, login.Stderr = os.Stderr, os.Stderr // login prints a URL to visit
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

func runToken(appOrigin string) (string, error) {
	out, err := exec.Command("cloudflared", "access", "token", "--app="+appOrigin).Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
