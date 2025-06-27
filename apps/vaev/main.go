package main

import (
	"embed"
	"fmt"
	"io/fs"
	"koppla/apps/vaev/views/dashboard"
	"koppla/apps/vaev/views/layout"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	"github.com/a-h/templ"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

//go:embed all:dist
var embedded_files embed.FS

func main() {
	static_fs, err := fs.Sub(embedded_files, "dist")
	if err != nil {
		log.Fatal("shitfuck")
		fmt.Printf("shitfuck")
	}

	r := chi.NewMux()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.Compress(5))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("{\"status\": \"ok\"}"))
		})
	})

	r.Route("/", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			templ.Handler(layout.Doc(func() templ.Component {
				return dashboard.Dashboard()
			})).ServeHTTP(w, r)
		})
	})

	is_dev := os.Getenv("APP_ENV") == "development"

	if is_dev {
		viteDevServerURL, _ := url.Parse("http://localhost:5173")
		proxy := httputil.NewSingleHostReverseProxy(viteDevServerURL)

		r.Handle("/public/*", http.StripPrefix("/public", proxy))

		log.Println("Development mode: proxying assets to Vite dev server.")
		r.NotFound(proxy.ServeHTTP)

	} else {
		r.Handle("/public/*", http.StripPrefix("/public", http.FileServer(http.FS(static_fs))))
	}

	fileServer := http.FileServer(http.FS(static_fs))

	r.Handle("/public/*", http.StripPrefix("/public", fileServer))

	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatal(err)
	}
}
