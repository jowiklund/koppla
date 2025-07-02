package main

import (
	"fmt"
	mw "koppla/apps/vaev/middleware"
	"koppla/apps/vaev/routing"
	"koppla/apps/vaev/vapi"
	"koppla/apps/vaev/views/auth"
	"koppla/apps/vaev/views/dashboard"
	"koppla/apps/vaev/views/graph"
	"koppla/apps/vaev/views/intro"
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
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	_ "koppla/apps/vaev/migrations"
)

type JsonError struct {
	Message string `db:"message" json:"message"`
	Status  int    `db:"status" json:"status"`
}

func main() {
	is_dev := os.Getenv("APP_ENV") == "development"
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: is_dev,
	})

	r := chi.NewMux()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.Compress(5))
	r.Use(mw.WithUserCTX(app))

	r.Group(func(r chi.Router) {
		r.Use(mw.WithAuthRedirectGuard(auth.R_LOGIN))
		r.Route("/dashboard", func(r chi.Router) {
			r.Get("/projects", func(w http.ResponseWriter, r *http.Request) {
				projects := []graph.Project{}

				user, err := auth.GetSignedInUser(app, r)
				if err != nil {
					log.Fatal("")
				}

				app.DB().
					Select("*").
					From("projects").
					Where(dbx.NewExp("owner = {:owner}", dbx.Params{"owner": user.Id})).
					All(&projects)

				fmt.Printf("%+v", projects)

				dasboard_styles := layout.NewStylesheet("/dist/dashboard.css")
				doc(func() templ.Component {
					return dashboard.Projects(projects)
				}, dasboard_styles).ServeHTTP(w, r)
			})
		})
		r.Get("/project/{id}", func(w http.ResponseWriter, r *http.Request) {
			project_id := chi.URLParam(r, "id")
			var project *graph.Project

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

			if project == nil {
				routing.RedirectTo(w, r, "/", false)
			}

			doc(
				func() templ.Component {
					return graph.Main(app, project_id)
				},
				layout.NewScript("/dist/graph.js"),
			).ServeHTTP(w, r)
		})
	})

	r.Route("/sse", func(r chi.Router) {
		r.Get("/project/{id}", func(w http.ResponseWriter, r *http.Request) {
			is_owner := dashboard.ValidateProjectOwner(app, w, r)
			if !is_owner {
				mw.WriteJSONUnauthorized(w)
				return
			}

			project_id := chi.URLParam(r, "id")

			node_types := []graph.NodeType{}
			app.DB().
				Select("*").
				From("node_types").
				Where(
					dbx.NewExp(
						"project = {:project_id}",
						dbx.Params{"project_id": project_id}),
				).
				All(&node_types)

			edge_types := &[]graph.EdgeType{}
			app.DB().
				Select("*").
				From("edge_types").
				Where(
					dbx.NewExp(
						"project = {:project_id}",
						dbx.Params{"project_id": project_id}),
				).
				All(edge_types)

			app.DB().
				Select("*").
				From("default_edge_types").
				Where(
					dbx.NewExp(
						"project = {:project_id}",
						dbx.Params{"project_id": project_id}),
				).
				All(edge_types)

			nodes := &[]graph.Node{}
			app.DB().
				Select("*").
				From("nodes").
				Where(
					dbx.NewExp(
						"project = {:project_id}",
						dbx.Params{"project_id": project_id}),
				).
				All(nodes)

			edges := &[]graph.Edge{}
			app.DB().
				Select("*").
				From("edges").
				Where(
					dbx.NewExp(
						"project = {:project_id}",
						dbx.Params{"project_id": project_id}),
				).
				All(edges)
		})
	})

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		_, err := auth.GetSignedInUser(app, r)
		if err == nil {
			routing.RedirectTo(w, r, "/dashboard/projects", false)
			return
		}

		templ.Handler(
			layout.Doc(
				func() templ.Component {
					return intro.Intro()
				},
				layout.NewStylesheet("/dist/intro.css"),
			),
		).ServeHTTP(w, r)
	})

	auth.AuthRoutes(app, r)
	vapi.RegisterVAPI(app, r)

	if is_dev {
		log.Println("Development mode: proxying to Vite server on http://localhost:5173")
		vite_proxy := newReverseProxy("http://localhost:5173")
		r.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/dist/index.js":
				r.URL.Path = "/frontend/js/index.js"
			case "/dist/graph.js":
				r.URL.Path = "/frontend/js/graph.js"
			case "/dist/style.css":
				r.URL.Path = "/frontend/css/style.css"
			case "/dist/intro.css":
				r.URL.Path = "/frontend/css/intro.css"
			case "/dist/dashboard.css":
				r.URL.Path = "/frontend/css/dashboard.css"
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

func doc(child func() templ.Component, resources ...layout.Resource) *templ.ComponentHandler {
	return templ.Handler(layout.Doc(child, resources...))
}

func newReverseProxy(target string) *httputil.ReverseProxy {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatalf("Failed to parse target URL for reverse proxy: %v", err)
	}
	return httputil.NewSingleHostReverseProxy(url)
}
