package vapi

import (
	"encoding/json"
	"fmt"
	"io"
	"koppla/apps/vaev/middleware"
	"koppla/apps/vaev/views/dashboard"
	"koppla/apps/vaev/views/graph"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
)

type GraphSignals struct {
	Project   graph.Project    `json:"project"`
	NodeTypes []graph.NodeType `json:"nodeTypes"`
	EdgeTypes []graph.EdgeType `json:"edgeTypes"`
	Nodes     []graph.Node     `json:"nodes"`
	Edges     []graph.Edge     `json:"edges"`
}

func RegisterVAPI(app *pocketbase.PocketBase, r *chi.Mux) {
	r.Group(func(r chi.Router) {
		r.Use(middleware.WithAuthJSONGuard(app))
		r.Route("/v-api/project", func(r chi.Router) {
			r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				project := dashboard.GetProject(app, r)
				if project == nil {
					log.Fatal("Project was nil")
				}

				data, err := json.Marshal(*project)
				if err != nil {
					log.Fatal(err)
				}

				w.Write(data)
			})
			r.Post("/{id}/save", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				body, err := io.ReadAll(r.Body)
				if err != nil {
					log.Fatal(err)
				}

				fmt.Printf("BYTES: %s", string(body))

				signals := GraphSignals{}
				json.Unmarshal(body, &signals)

				for _, node := range signals.Nodes {
					app.DB().
						NewQuery("UPDATE nodes SET x = {:x}, y = {:y} WHERE id = {:id}").
						Bind(dbx.Params{
							"x":  node.X,
							"y":  node.Y,
							"id": node.Id,
						}).
						Execute()
				}
			})
			r.Get("/{id}/node-types", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
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

				data, err := json.Marshal(&node_types)
				if err != nil {
					log.Fatal(err)
				}
				w.Write(data)
			})
			r.Get("/{id}/edge-types", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				project_id := chi.URLParam(r, "id")
				edge_types := []graph.EdgeType{}
				app.DB().
					Select("*").
					From("edge_types").
					Where(
						dbx.NewExp(
							"project = {:project_id}",
							dbx.Params{"project_id": project_id}),
					).
					All(&edge_types)

				data, err := json.Marshal(&edge_types)
				if err != nil {
					log.Fatal(err)
				}
				w.Write(data)
			})
			r.Get("/{id}/nodes", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				project_id := chi.URLParam(r, "id")
				fmt.Printf("\n%+v\n", project_id)
				nodes := []graph.Node{}
				err := app.DB().
					Select("*").
					From("nodes").
					Where(
						dbx.NewExp(
							"project = {:project_id}",
							dbx.Params{"project_id": project_id}),
					).
					All(&nodes)
				if err != nil {
					log.Fatal(err)
				}

				fmt.Printf("\n%+v\n", nodes)
				data, err := json.Marshal(&nodes)
				if err != nil {
					log.Fatal(err)
				}
				w.Write(data)
			})
			r.Get("/{id}/edges", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				project_id := chi.URLParam(r, "id")
				edges := []graph.Edge{}
				app.DB().
					Select("*").
					From("edges").
					Where(
						dbx.NewExp(
							"project = {:project_id}",
							dbx.Params{"project_id": project_id}),
					).
					All(&edges)

				data, err := json.Marshal(&edges)
				if err != nil {
					log.Fatal(err)
				}
				w.Write(data)
			})
			r.Put("/{id}/update-nodes", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				body, err := io.ReadAll(r.Body)
				defer r.Body.Close()
				if err != nil {
					log.Fatal(err)
				}

				nodes := []graph.Node{}
				if err := json.Unmarshal(body, &nodes); err != nil {
					log.Fatal(err)
				}

				for _, node := range nodes {
					fmt.Printf("\nBYTES: %s\n", string(body))
					app.DB().
						NewQuery("UPDATE nodes SET x = {:x}, y = {:y} WHERE id = {:id}").
						Bind(dbx.Params{
							"x":  node.X,
							"y":  node.Y,
							"id": node.Id,
						}).
						Execute()
				}
			})
			r.Delete("/{id}/delete-nodes", func(w http.ResponseWriter, r *http.Request) {
				fmt.Printf("")
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				body, err := io.ReadAll(r.Body)
				defer r.Body.Close()
				if err != nil {
					log.Fatal(err)
				}

				node_ids := []string{}
				if err := json.Unmarshal(body, &node_ids); err != nil {
					log.Fatal(err)
				}

				count := 0
				for _, id := range node_ids {
					_, err := app.DB().
						Delete("nodes", dbx.NewExp("id = {:id}", dbx.Params{
							"id": id,
						})).
						Execute()
					if err != nil {
						log.Fatal(err)
					}
					count += 1
				}

				w.Write(fmt.Appendf(nil, `{"message": "Deteted %d nodes"}`, count))
			})
			r.Post("/{id}/create-nodes", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				project := dashboard.GetProject(app, r)

				body, err := io.ReadAll(r.Body)
				if err != nil {
					log.Fatal(err)
				}

				nodes := []graph.Node{}
				if err := json.Unmarshal(body, &nodes); err != nil {
					log.Fatal(err)
				}

				fmt.Printf("%+v", nodes)

				query := `
				INSERT INTO nodes (x, y, name, project, type, metadata)
				VALUES ({:x}, {:y}, {:name}, {:project}, {:type}, {:metadata})
				RETURNING x, y, name, type, id, metadata
				`

				res_nodes := []graph.Node{}
				var x, y int
				var name, type_id, id string
				var metadata []byte

				for _, node := range nodes {
					if err := app.DB().
						NewQuery(query).Bind(dbx.Params{
						"x":        node.X,
						"y":        node.Y,
						"name":     node.Name,
						"metadata": node.Metadata,
						"project":  project.Id,
						"type":     node.Type,
					}).Row(&x, &y, &name, &type_id, &id, &metadata); err != nil {
						log.Fatal(err)
					}
					res_nodes = append(res_nodes, graph.Node{
						X:        x,
						Y:        y,
						Id:       id,
						Name:     name,
						Type:     type_id,
						Metadata: metadata,
						TempId:   node.Id,
					})
				}

				bytes, err := json.Marshal(&res_nodes)
				fmt.Print(string(bytes))
				if err != nil {
					log.Fatal(err)
				}
				w.Write(bytes)
			})
			r.Post("/{id}/create-edge", func(w http.ResponseWriter, r *http.Request) {
				is_owner := dashboard.ValidateProjectOwner(app, w, r)
				if !is_owner {
					middleware.WriteJSONUnauthorized(w)
					return
				}

				project := dashboard.GetProject(app, r)

				body, err := io.ReadAll(r.Body)
				if err != nil {
					log.Fatal(err)
				}

				edge := graph.Edge{}
				if err := json.Unmarshal(body, &edge); err != nil {
					log.Fatal(err)
				}

				query := `
				INSERT INTO edges (start_id, end_id, type, project)
				VALUES ({:start_id}, {:end_id}, {:type}, {:project})
				RETURNING id 
				`

				var id string
				if err := app.DB().
					NewQuery(query).Bind(dbx.Params{
					"start_id": edge.StartId,
					"end_id":   edge.EndId,
					"type":     edge.Type,
					"project":  project.Id,
				}).Row(&id); err != nil {
					log.Fatal(err)
				}

				edge.Id = id

				fmt.Printf("\n%+v\n", edge)

				bytes, err := json.Marshal(&edge)
				fmt.Print(string(bytes))
				if err != nil {
					log.Fatal(err)
				}
				w.Write(bytes)
			})
		})
	})
}
