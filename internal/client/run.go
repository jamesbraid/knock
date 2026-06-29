package client

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// FamilyResult is the outcome for one IP family.
type FamilyResult struct {
	Label string // "v4" / "v6"
	IP    string
	Err   error
}

type registerFunc func(ctx context.Context, network, registerURL, token, method string) (string, error)

// Options configures a Run. Register is the injection point for tests; nil uses
// the real forced-dialer path.
type Options struct {
	URL        string
	Unregister bool
	Token      string
	Register   registerFunc
}

var families = []struct{ label, network string }{
	{"v4", "tcp4"},
	{"v6", "tcp6"},
}

func defaultRegister(ctx context.Context, network, registerURL, token, method string) (string, error) {
	return registerOne(ctx, familyClient(network, 5*time.Second), registerURL, token, method)
}

// Run registers (or unregisters) both families concurrently and returns the
// user-facing line and process exit code.
func Run(ctx context.Context, o Options) (string, int) {
	reg := o.Register
	if reg == nil {
		reg = defaultRegister
	}
	method, verb := "POST", "registered"
	if o.Unregister {
		method, verb = "DELETE", "unregistered"
	}
	results := make([]FamilyResult, len(families))
	var wg sync.WaitGroup
	for i, f := range families {
		wg.Add(1)
		go func(i int, label, network string) {
			defer wg.Done()
			ip, err := reg(ctx, network, o.URL, o.Token, method)
			results[i] = FamilyResult{Label: label, IP: ip, Err: err}
		}(i, f.label, f.network)
	}
	wg.Wait()
	return FormatResults(verb, results)
}

// FormatResults renders "verb: v4=.. v6=.." (failed families shown as
// "(v6: no route)") and the exit code: 0 if any family succeeded, else 1.
func FormatResults(verb string, results []FamilyResult) (string, int) {
	var ok, failed []string
	okCount := 0
	for _, r := range results {
		if r.Err == nil {
			ok = append(ok, fmt.Sprintf("%s=%s", r.Label, r.IP))
			okCount++
		} else {
			failed = append(failed, fmt.Sprintf("(%s: %s)", r.Label, shortErr(r.Err)))
		}
	}
	line := verb + ": " + strings.Join(append(ok, failed...), "  ")
	if okCount == 0 {
		return line, 1
	}
	return line, 0
}

func shortErr(err error) string {
	s := err.Error()
	for _, sig := range []string{"no route", "network is unreachable", "no suitable address", "connect:"} {
		if strings.Contains(s, sig) {
			return "no route"
		}
	}
	return s
}
