package client

import (
	"errors"
	"net/url"
)

// ResolveURL picks the register URL: --url flag wins over $KNOCK_URL.
func ResolveURL(flagURL, envURL string) (string, error) {
	if flagURL != "" {
		return flagURL, nil
	}
	if envURL != "" {
		return envURL, nil
	}
	return "", errors.New("no knock URL: pass --url or set KNOCK_URL")
}

// OriginOf returns scheme://host, for the `cloudflared access --app` argument.
func OriginOf(rawURL string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	if u.Scheme == "" || u.Host == "" {
		return "", errors.New("invalid URL (need scheme and host): " + rawURL)
	}
	return u.Scheme + "://" + u.Host, nil
}
