package dashboard

import (
	"koppla/apps/vaev/middleware"
	"koppla/apps/vaev/views/auth"
	"koppla/apps/vaev/views/graph"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
)

func GetProject(app *pocketbase.PocketBase, r *http.Request) *graph.Project {
	project_id := chi.URLParam(r, "id")
	if project_id == "" {
		return nil
	}

	project := &graph.Project{}

	app.DB().
		Select("*").
		From("projects").
		Where(dbx.NewExp("id = {:id}", dbx.Params{"id": project_id})).
		One(project)

	return project
}

func ValidateProjectOwner(app *pocketbase.PocketBase, w http.ResponseWriter, r *http.Request) bool {
	project := GetProject(app, r)
	if project == nil {
		middleware.WriteJSONNotFound(w)
		return false
	}

	user, err := auth.GetSignedInUser(app, r)
	if err != nil {
		return false
	}

	if project.Owner != user.Id {
		middleware.WriteJSONUnauthorized(w)
		return false
	}

	return true
}
