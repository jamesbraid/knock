package client

import "testing"

func TestResolveURL(t *testing.T) {
	cases := []struct {
		name, flag, env, want string
		wantErr               bool
	}{
		{"flag wins", "https://a/register", "https://b/register", "https://a/register", false},
		{"env fallback", "", "https://b/register", "https://b/register", false},
		{"neither set", "", "", "", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := ResolveURL(c.flag, c.env)
			if c.wantErr != (err != nil) {
				t.Fatalf("err=%v wantErr=%v", err, c.wantErr)
			}
			if got != c.want {
				t.Fatalf("got %q want %q", got, c.want)
			}
		})
	}
}

func TestOriginOf(t *testing.T) {
	got, err := OriginOf("https://knock.example.com/register")
	if err != nil || got != "https://knock.example.com" {
		t.Fatalf("got %q err %v", got, err)
	}
	if _, err := OriginOf("not a url"); err == nil {
		t.Fatal("expected error for schemeless url")
	}
}
