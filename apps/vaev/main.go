package main

import (
	"context"
	"fmt"
	"koppla/apps/vaev/views/auth"
	"koppla/apps/vaev/views/graph"
	"koppla/apps/vaev/views/layout"
	"koppla/apps/vaev/views/toaster"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/a-h/templ"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	datastar "github.com/starfederation/datastar/sdk/go"
)

const VAEV_AUTH_COOKIE = "vaev-auth"
const VAEV_AUTH_CTX = "vaev-auth"
const VAEV_LOGIN_ROUTE = "/login"

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
	r.Use(withAuth(app))

	r.Group(func(r chi.Router) {
		r.Use(withAuthGuard)
		r.Get("/hello", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("You fine"))
		})

		r.Route("/project", func(r chi.Router) {
			r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
				project_id := chi.URLParam(r, "id")
				project := graph.Project{}

				user, err := getSignedInUser(app, r)
				if err != nil {
					log.Fatal("User was nil when saving project")
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
			r.Post("/{id}/save", func(w http.ResponseWriter, r *http.Request) {
				project_id := chi.URLParam(r, "id")
				project := graph.Project{}

				user, err := getSignedInUser(app, r)
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

	r.Route("/sse", func(r chi.Router) {
		r.Get("/default-node-types", func(w http.ResponseWriter, r *http.Request) {
			sse := datastar.NewSSE(w, r)

			node_types := graph.GetNodeTypes(app)

			for _, n := range *node_types {
				fmt.Printf("\n%s\n", n.Name)
			}

			html := graph.NodeTypeSelect(app)

			sse.MergeFragmentTempl(
				html,
			)
		})
	})

	r.Get(VAEV_LOGIN_ROUTE, func(w http.ResponseWriter, r *http.Request) {
		if cookie, err := r.Cookie(VAEV_AUTH_COOKIE); err == nil {
			_, err := app.FindAuthRecordByToken(cookie.Value)
			if err == nil {
				http.Redirect(w, r, "/project/asdas", http.StatusTemporaryRedirect)
				return
			}

			http.SetCookie(w, &http.Cookie{
				Name:     VAEV_AUTH_COOKIE,
				Value:    "",
				MaxAge:   -1,
				Path:     "/",
				HttpOnly: true,
			})
		}

		templ.Handler(layout.Doc(func() templ.Component {
			return auth.Login()
		})).ServeHTTP(w, r)
	})

	r.Post("/auth/login", func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("GOT LOGIN")
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			log.Fatal(err)
		}

		data := &struct {
			Username string `db:"username" json:"username"`
			Password string `db:"password" json:"password"`
		}{}

		defer r.Body.Close()
		r.ParseMultipartForm(1024)
		fmt.Printf("\n%s", r.FormValue("username"))
		fmt.Printf("\n%s\n", r.FormValue("password"))

		data.Username = r.FormValue("username")
		data.Password = r.FormValue("password")

		fmt.Printf("%+v", *data)

		auth, err := app.FindAuthRecordByEmail(users, data.Username)
		if err != nil {
			sse := datastar.NewSSE(w, r)
			sendErrorMessage(sse, "Invalid credentials")
			sse.ExecuteScript(`document.getElementById("login-form").reset();`)
		}

		valid_pass := auth.ValidatePassword(data.Password)

		if valid_pass {
			token, err := auth.NewAuthToken()
			if err != nil {
				log.Fatal(err)
			}

			http.SetCookie(w, &http.Cookie{
				Name:     VAEV_AUTH_COOKIE,
				Value:    token,
				Expires:  time.Now().Add(time.Hour * (24 * 365)),
				Secure:   true,
				HttpOnly: true,
				SameSite: http.SameSiteStrictMode,
				Path:     "/",
			})

			http.Redirect(w, r, "/project/asdas", http.StatusTemporaryRedirect)
			return
		}

		sse := datastar.NewSSE(w, r)
		sendErrorMessage(sse, "Invalid credentials")
		sse.ExecuteScript(`document.getElementById("login-form").reset();`)
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

func withAuth(app *pocketbase.PocketBase) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		fn := func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(VAEV_AUTH_COOKIE)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			user, err := app.FindAuthRecordByToken(cookie.Value, "auth")
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			new_ctx := context.WithValue(r.Context(), VAEV_AUTH_CTX, user)
			next.ServeHTTP(w, r.WithContext(new_ctx))
		}
		return http.HandlerFunc(fn)
	}
}

func withAuthGuard(next http.Handler) http.Handler {
	fn := func(w http.ResponseWriter, r *http.Request) {
		auth := r.Context().Value(VAEV_AUTH_CTX)
		if auth == nil {
			r.Header.Add("Location", "/")
			http.Redirect(w, r, VAEV_LOGIN_ROUTE, http.StatusTemporaryRedirect)
			return
		}
		next.ServeHTTP(w, r)
	}

	return http.HandlerFunc(fn)
}

func getSignedInUser(app *pocketbase.PocketBase, r *http.Request) (*graph.User, error) {
	auth := r.Context().Value(VAEV_AUTH_CTX).(*core.Record)
	if auth == nil {
		return nil, fmt.Errorf("No user is logged in")
	}

	user := graph.User{}

	app.DB().
		Select("*").
		From("users").
		Where(dbx.NewExp("id = {:id}", dbx.Params{"id": auth.Id})).
		One(&user)

	return &user, nil
}

func newReverseProxy(target string) *httputil.ReverseProxy {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatalf("Failed to parse target URL for reverse proxy: %v", err)
	}
	return httputil.NewSingleHostReverseProxy(url)
}

func sendErrorMessage(sse *datastar.ServerSentEventGenerator, msg string) {
	time := time.Now()
	sse.MergeFragmentTempl(
		toaster.ErrorMessage(msg, fmt.Sprint(time.UnixMilli())),
		datastar.WithMergeMode(datastar.FragmentMergeModeAppend),
		datastar.WithSelectorID("toaster"),
	)
}
