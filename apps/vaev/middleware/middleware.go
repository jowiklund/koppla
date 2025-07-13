package middleware

import (
	"context"
	"encoding/json"
	"koppla/apps/vaev/constants"
	"koppla/apps/vaev/routing"
	"log"
	"net/http"

	"github.com/pocketbase/pocketbase"
)

type JSONErrorMessage struct {
	Message string `db:"message" json:"message"`
}

func WriteJSONUnauthorized(w http.ResponseWriter) {
	bytes, err := json.Marshal(JSONErrorMessage{
		Message: "You are not authorized to access this resource",
	})
	if err != nil {
		log.Fatal(err)
	}
	w.WriteHeader(http.StatusUnauthorized)
	w.Write(bytes)
}

func WriteJSONNotFound(w http.ResponseWriter) {
	bytes, err := json.Marshal(JSONErrorMessage{
		Message: "Not found",
	})
	if err != nil {
		log.Fatal(err)
	}
	w.Write(bytes)
}

func WithUserCTX(app *pocketbase.PocketBase) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		fn := func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(constants.COOKIE_AUTH)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			user, err := app.FindAuthRecordByToken(cookie.Value, "auth")
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			new_ctx := context.WithValue(r.Context(), constants.CTX_AUTH, user)
			next.ServeHTTP(w, r.WithContext(new_ctx))
		}
		return http.HandlerFunc(fn)
	}
}

func WithAuthRedirectGuard(to string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		fn := func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context().Value(constants.CTX_AUTH)

			if ctx == nil {
				r.Header.Add("Location", "/")
				routing.RedirectTo(w, r, to, true)
				return
			}
			next.ServeHTTP(w, r)
		}

		return http.HandlerFunc(fn)
	}
}
