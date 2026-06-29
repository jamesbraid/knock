package client

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestParseRegisteredIP(t *testing.T) {
	ip, err := parseRegisteredIP("Registered 1.2.3.4 for 24h\n")
	if err != nil || ip != "1.2.3.4" {
		t.Fatalf("got %q err %v", ip, err)
	}
	if _, err := parseRegisteredIP("nope"); err == nil {
		t.Fatal("expected error on malformed body")
	}
}

func TestRegisterOneSendsHeaderAndMethod(t *testing.T) {
	var gotMethod, gotToken string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotToken = r.Header.Get("Cf-Access-Token")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("Registered 9.9.9.9 for 24h\n"))
	}))
	defer srv.Close()

	ip, err := registerOne(context.Background(), srv.Client(), srv.URL+"/register", "TOK123", "POST")
	if err != nil {
		t.Fatal(err)
	}
	if ip != "9.9.9.9" || gotMethod != "POST" || gotToken != "TOK123" {
		t.Fatalf("ip=%q method=%q token=%q", ip, gotMethod, gotToken)
	}
}

func TestRegisterOneNon2xxIsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("Missing CF-Connecting-IP\n"))
	}))
	defer srv.Close()
	if _, err := registerOne(context.Background(), srv.Client(), srv.URL+"/register", "T", "POST"); err == nil {
		t.Fatal("expected error on 400")
	}
}

func TestFamilyClientTCP6FailsAgainstV4OnlyServer(t *testing.T) {
	// httptest binds 127.0.0.1 (v4 only); forcing tcp6 must fail to dial.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("Registered 9.9.9.9 for 24h\n"))
	}))
	defer srv.Close()
	c := familyClient("tcp6", 2*time.Second)
	if _, err := registerOne(context.Background(), c, srv.URL+"/register", "T", "POST"); err == nil {
		t.Fatal("expected tcp6 dial failure against a v4-only server")
	}
}
