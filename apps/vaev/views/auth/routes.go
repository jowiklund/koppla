package auth

import (
	"fmt"
	"koppla/apps/vaev/constants"
	"koppla/apps/vaev/middleware"
	"koppla/apps/vaev/routing"
	"koppla/apps/vaev/views/layout"
	"koppla/apps/vaev/views/toaster"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/a-h/templ"
	"github.com/go-chi/chi/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	datastar "github.com/starfederation/datastar/sdk/go"
)

const (
	R_LOGIN      = "/login"
	R_VALIDATE   = "/auth/validate"
	R_INVALIDATE = "/auth/logout"
	R_USER       = "/auth/user"
)

func AuthRoutes(app *pocketbase.PocketBase, r *chi.Mux) {
	r.Get(R_USER, func(w http.ResponseWriter, r *http.Request) {
		sse := datastar.NewSSE(w, r)
		user, err := GetSignedInUser(app, r)

		if err != nil {
			sse.MergeFragmentTempl(
				GuestCard(),
				datastar.WithSelectorID("user-card"),
			)
		}

		sse.MergeFragmentTempl(
			UserCard(user),
			datastar.WithSelectorID("user-card"),
		)
	})

	r.Get(R_LOGIN, func(w http.ResponseWriter, r *http.Request) {
		next := r.URL.Query().Get("next")
		next_parsed, err := url.QueryUnescape(next)
		if err != nil {
			log.Fatalf("Unable to parse next: %s", next)
		}
		if cookie, err := r.Cookie(constants.COOKIE_AUTH); err == nil {
			_, err := app.FindAuthRecordByToken(cookie.Value)
			if err == nil {
				routing.BounceBack(w, r)
				return
			}

			routing.DestroyCookie(w, constants.COOKIE_AUTH)
		}

		templ.Handler(layout.Doc(func() templ.Component {
			return Login(next_parsed)
		})).ServeHTTP(w, r)
	})

	r.Post(R_VALIDATE, func(w http.ResponseWriter, r *http.Request) {
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

		data.Username = r.FormValue("username")
		data.Password = r.FormValue("password")

		auth, err := app.FindAuthRecordByEmail(users, data.Username)
		if err != nil {
			sse := datastar.NewSSE(w, r)
			toaster.SendErrorMessage(sse, "Invalid credentials")
			sse.ExecuteScript(`document.getElementById("login-form").reset();`)
		}

		valid_pass := auth.ValidatePassword(data.Password)

		if valid_pass {
			token, err := auth.NewAuthToken()
			if err != nil {
				sse := datastar.NewSSE(w, r)
				toaster.SendErrorMessage(sse, "Invalid credentials")
				sse.ExecuteScript(`document.getElementById("login-form").reset();`)
			}

			http.SetCookie(w, &http.Cookie{
				Name:     constants.COOKIE_AUTH,
				Value:    token,
				Expires:  time.Now().Add(time.Hour * (24 * 365)),
				Secure:   true,
				HttpOnly: true,
				SameSite: http.SameSiteStrictMode,
				Path:     "/",
			})

			log.Println("Bouncing back")
			routing.BounceBackSSE(w, r)
			return
		}

		sse := datastar.NewSSE(w, r)
		toaster.SendErrorMessage(sse, "Invalid credentials")
		sse.ExecuteScript(`document.getElementById("login-form").reset();`)
	})

	r.Post(R_INVALIDATE, func(w http.ResponseWriter, r *http.Request) {
		routing.DestroyCookie(w, constants.COOKIE_AUTH)
		routing.RedirectToSSE(w, r, R_LOGIN, false)
	})
}

func WithAuthJSONGuard(app *pocketbase.PocketBase) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		fn := func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, err := GetSignedInUser(app, r)
			if err != nil {
				middleware.WriteJSONUnauthorized(w)
				return
			}
			next.ServeHTTP(w, r)
		}
		return http.HandlerFunc(fn)
	}
}

func GetSignedInUser(app *pocketbase.PocketBase, r *http.Request) (*User, error) {
	auth := r.Context().Value(constants.CTX_AUTH)
	switch auth := auth.(type) {
	case *core.Record:
		user := User{}

		app.DB().
			Select("*").
			From("users").
			Where(dbx.NewExp("id = {:id}", dbx.Params{"id": auth.Id})).
			One(&user)

		return &user, nil
	default:
		return nil, fmt.Errorf("No signed in user")
	}
}
