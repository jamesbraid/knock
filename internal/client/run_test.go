package client

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestFormatResultsBothOK(t *testing.T) {
	line, code := FormatResults("registered", []FamilyResult{
		{Label: "v4", IP: "1.2.3.4"},
		{Label: "v6", IP: "2001:db8::1"},
	})
	if code != 0 || !strings.Contains(line, "v4=1.2.3.4") || !strings.Contains(line, "v6=2001:db8::1") {
		t.Fatalf("line=%q code=%d", line, code)
	}
}

func TestFormatResultsSingleStackExitsZero(t *testing.T) {
	line, code := FormatResults("registered", []FamilyResult{
		{Label: "v4", IP: "1.2.3.4"},
		{Label: "v6", Err: errors.New("dial tcp6: connect: network is unreachable")},
	})
	if code != 0 {
		t.Fatalf("single-stack should exit 0, got %d", code)
	}
	if !strings.Contains(line, "v4=1.2.3.4") || !strings.Contains(line, "v6: no route") {
		t.Fatalf("line=%q", line)
	}
}

func TestFormatResultsAllFailExitsOne(t *testing.T) {
	_, code := FormatResults("registered", []FamilyResult{
		{Label: "v4", Err: errors.New("boom")},
		{Label: "v6", Err: errors.New("boom")},
	})
	if code != 1 {
		t.Fatalf("all-fail should exit 1, got %d", code)
	}
}

func TestRunUsesInjectedRegisterAndDeleteVerb(t *testing.T) {
	var gotMethod string
	fake := func(_ context.Context, network, _, _, method string) (string, error) {
		gotMethod = method
		if network == "tcp4" {
			return "1.2.3.4", nil
		}
		return "2001:db8::1", nil
	}
	line, code := Run(context.Background(), Options{
		URL: "https://knock.example.com/register", Unregister: true, Token: "T", Register: fake,
	})
	if code != 0 || gotMethod != "DELETE" || !strings.HasPrefix(line, "unregistered:") {
		t.Fatalf("line=%q code=%d method=%q", line, code, gotMethod)
	}
}
