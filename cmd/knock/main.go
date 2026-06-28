package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/jamesbraid/knock/internal/client"
)

func main() {
	var urlFlag string
	var unregister bool
	flag.StringVar(&urlFlag, "url", "", "knock register URL (or set KNOCK_URL)")
	flag.BoolVar(&unregister, "d", false, "unregister instead of register")
	flag.BoolVar(&unregister, "unregister", false, "unregister instead of register")
	flag.Parse()

	registerURL, err := client.ResolveURL(urlFlag, os.Getenv("KNOCK_URL"))
	if err != nil {
		fmt.Fprintln(os.Stderr, "knock: "+err.Error())
		os.Exit(2)
	}
	origin, err := client.OriginOf(registerURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "knock: "+err.Error())
		os.Exit(2)
	}
	token, err := client.CloudflaredToken(origin)
	if err != nil {
		fmt.Fprintln(os.Stderr, "knock: "+err.Error())
		os.Exit(1)
	}
	out, code := client.Run(context.Background(), client.Options{
		URL: registerURL, Unregister: unregister, Token: token,
	})
	fmt.Println(out)
	os.Exit(code)
}
