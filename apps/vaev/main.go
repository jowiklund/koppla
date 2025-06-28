package main

import (
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

func main() {
	r := chi.NewMux()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.Compress(5))

	is_dev := os.Getenv("APP_ENV") == "development"

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("{\"status\": \"ok\"}"))
		})
	})

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		templ.Handler(layout.Doc(func() templ.Component {
			return dashboard.Dashboard()
		})).ServeHTTP(w, r)
	})

	if is_dev {
		log.Println("Development mode: proxying to Vite server on http://localhost:5173")
		vite_proxy := newReverseProxy("http://localhost:5173")
		r.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/dist/index.js" {
				r.URL.Path = "/frontend/js/index.js"
			} else if r.URL.Path == "/dist/style.css" {
				r.URL.Path = "/frontend/css/style.css"
			}

			vite_proxy.ServeHTTP(w, r)
		})

	} else {
		log.Println("Production mode: serving assets from embedded filesystem.")
		file_server_handler := GetStaticFileServer()
		r.Handle("/dist/*", http.StripPrefix("/dist", file_server_handler))
	}

	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatal(err)
	}
}

func newReverseProxy(target string) *httputil.ReverseProxy {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatalf("Failed to parse target URL for reverse proxy: %v", err)
	}
	return httputil.NewSingleHostReverseProxy(url)
}
