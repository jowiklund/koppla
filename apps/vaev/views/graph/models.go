package graph

import "github.com/pocketbase/pocketbase"

type NodeType struct {
	StrokeWidth uint8  `db:"stroke_width" json:"stroke_width"`
	Shape       uint8  `db:"shape" json:"shape"`
	Id          string `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	FillColor   string `db:"fill_color" json:"fill_color"`
	StrokeColor string `db:"stroke_color" json:"stroke_color"`
	Metadata    string `db:"metadata" json:"metadata"`
}

func GetNodeTypes(app *pocketbase.PocketBase) *[]NodeType {
	node_types := []NodeType{}

	app.DB().
		Select("*").
		From("default_node_types").
		All(&node_types)

	return &node_types
}

type EdgeType struct {
	StrokeWidth uint8  `db:"stroke_width" json:"stroke_width"`
	Id          string `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	StrokeColor string `db:"stroke_color" json:"stroke_color"`
	LineDash    string `db:"line_dash" json:"line_dash"`
	Metadata    string `db:"metadata" json:"metadata"`
}

func GetEdgeTypes(app *pocketbase.PocketBase) *[]EdgeType {
	edge_types := []EdgeType{}

	app.DB().
		Select("*").
		From("default_edge_types").
		All(&edge_types)

	return &edge_types
}

type Project struct {
	Id      string `db:"id" json:"id"`
	Owner   string `db:"owner" json:"owner"`
	Name    string `db:"name" json:"name"`
	Updated string `db:"updated" json:"updated"`
	Created string `db:"created" json:"created"`
}
