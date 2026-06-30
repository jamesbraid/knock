package client

import "testing"

// loginArgs must pass --quiet so cloudflared does not print the fetched JWT to
// stdout. CloudflaredToken wires login's stdout to the process stderr to show
// the browser-login URL; without --quiet that wiring would echo the token to
// the user's terminal. This is the regression guard for that leak.
func TestLoginArgsQuiet(t *testing.T) {
	args := loginArgs("https://app.example.com")

	var hasQuiet, hasApp bool
	for _, a := range args {
		switch a {
		case "--quiet":
			hasQuiet = true
		case "--app=https://app.example.com":
			hasApp = true
		}
	}

	if !hasQuiet {
		t.Errorf("loginArgs must include --quiet to avoid leaking the JWT; got %v", args)
	}
	if !hasApp {
		t.Errorf("loginArgs must target the app origin; got %v", args)
	}
}
