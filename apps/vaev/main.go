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
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	is_dev := os.Getenv("APP_ENV") == "development"
	app := pocketbase.New()

	r := chi.NewMux()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.Compress(5))

	r.Get("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("{\"status\": \"ok\"}"))
	})

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		templ.Handler(layout.Doc(func() templ.Component {
			return dashboard.Main()
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

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/hi/{name}", func(e *core.RequestEvent) error {
			name := e.Request.PathValue("name")
			return e.String(http.StatusOK, "Hello "+name)
		})

		se.Router.Any("/", apis.WrapStdHandler(r))
		return se.Next()
	})

	if err := app.Start(); err != nil {
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
