//go:build production

package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
)

//go:embed all:dist
var embeddedFiles embed.FS

func GetStaticFileServer() http.Handler {
	distFS, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		log.Fatal("failed to get 'dist'g subdirectory from embedded files", err)
	}
	return http.FileServer(http.FS(distFS))
}
