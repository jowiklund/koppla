//go:build !production

package main

import "net/http"

func GetStaticFileServer() http.Handler {
	return http.NotFoundHandler()
}
