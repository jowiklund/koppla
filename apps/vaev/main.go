package main

import (
	"fmt"
	"koppla/apps/vaev/views/auth"
	"koppla/apps/vaev/views/graph"
	"koppla/apps/vaev/views/layout"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	"github.com/a-h/templ"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

type JsonError struct {
	Message string `db:"message" json:"message"`
	Status  int    `db:"status" json:"status"`
}

func main() {
	is_dev := os.Getenv("APP_ENV") == "development"
	app := pocketbase.New()

	r := chi.NewMux()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.Compress(5))
	r.Use(auth.WithUserCTX(app))

	r.Group(func(r chi.Router) {
		r.Use(auth.WithAuthGuard)
		r.Get("/hello", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("You fine"))
		})

		r.Route("/project", func(r chi.Router) {
			r.Post("/{id}/save", func(w http.ResponseWriter, r *http.Request) {
				project_id := chi.URLParam(r, "id")
				project := graph.Project{}

				user, err := auth.GetSignedInUser(app, r)
				if err != nil {
					log.Fatal("User was nil when saving project")
				}

				fmt.Printf("%+v", user)

				app.DB().
					Select("*").
					From("projects").
					Where(dbx.NewExp("id = {:id}", dbx.Params{"id": project_id})).
					AndWhere(dbx.NewExp("owner = {:owner}", dbx.Params{"owner": user.Id})).
					One(&project)

				fmt.Printf("%+v", project)
			})
			r.Post("/{id}/load", func(w http.ResponseWriter, r *http.Request) {
			})
		})

	})

	r.Get("/project/{id}", func(w http.ResponseWriter, r *http.Request) {
		project_id := chi.URLParam(r, "id")
		project := graph.Project{}

		user, err := auth.GetSignedInUser(app, r)
		if err != nil {
			log.Print(err)
			templ.Handler(layout.Doc(func() templ.Component {
				return graph.Main(app, project_id)
			})).ServeHTTP(w, r)
			return
		}

		app.DB().
			Select("*").
			From("projects").
			Where(dbx.NewExp("id = {:id}", dbx.Params{"id": project_id})).
			AndWhere(dbx.NewExp("owner = {:owner}", dbx.Params{"owner": user.Id})).
			One(&project)

		fmt.Printf("%+v", project)

		templ.Handler(layout.Doc(func() templ.Component {
			return graph.Main(app, project_id)
		})).ServeHTTP(w, r)
	})

	auth.AuthRoutes(app, r)

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
		r.HandleFunc("/@vite/", vite_proxy.ServeHTTP)
	} else {
		log.Println("Production mode: serving assets from embedded filesystem.")
		file_server_handler := GetStaticFileServer()
		r.Handle("/dist/*", http.StripPrefix("/dist", file_server_handler))
	}

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
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
