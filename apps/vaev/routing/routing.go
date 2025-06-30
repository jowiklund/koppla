package routing

import (
	"fmt"
	"log"
	"net/http"
	"net/url"

	datastar "github.com/starfederation/datastar/sdk/go"
)

func BounceBack(w http.ResponseWriter, r *http.Request) {
	next := r.URL.Query().Get("next")

	next_unescaped, err := url.QueryUnescape(next)
	if err != nil {
		log.Fatalf("Could not parse bounce back query: %s", next)
	}

	if len(next_unescaped) > 0 {
		log.Printf("Redirecting user to %s", next)
		http.Redirect(w, r, next_unescaped, http.StatusSeeOther)
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func BounceBackSSE(w http.ResponseWriter, r *http.Request) {
	sse := datastar.NewSSE(w, r)
	next := r.URL.Query().Get("next")

	next_unescaped, err := url.QueryUnescape(next)
	if err != nil {
		log.Fatalf("Could not parse bounce back query: %s", next)
	}

	if len(next_unescaped) > 0 {
		log.Printf("Redirecting user to %s", next_unescaped)
		sse.ExecuteScript(fmt.Sprintf(`
			window.location = "%s"
		`, next_unescaped))
	}
	sse.ExecuteScript(`window.location = "/"`)
}

func RedirectTo(w http.ResponseWriter, r *http.Request, to string, add_next bool) {
	query := ""
	if add_next {
		query = fmt.Sprintf("?next=%s", url.QueryEscape(r.URL.EscapedPath()))
	}
	http.Redirect(w, r, to+query, http.StatusSeeOther)
}

func RedirectToSSE(w http.ResponseWriter, r *http.Request, to string, add_next bool) {
	sse := datastar.NewSSE(w, r)
	query := ""
	if add_next {
		query = fmt.Sprintf("?next=%s", url.QueryEscape(r.URL.EscapedPath()))
	}
	sse.ExecuteScript(fmt.Sprintf(`window.location = "%s"`, to+query))
}

func DestroyCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		MaxAge:   -1,
		Path:     "/",
		HttpOnly: true,
	})
}
