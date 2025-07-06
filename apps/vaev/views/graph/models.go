package graph

import (
	"github.com/pocketbase/pocketbase"
)

type Node struct {
	Id       string `db:"id" json:"id"`
	Name     string `db:"name" json:"name"`
	Project  string `db:"project" json:"project"`
	Type     string `db:"type" json:"type"`
	Created  string `db:"created" json:"created"`
	Updated  string `db:"updated" json:"updated"`
	Metadata []byte `db:"metadata" json:"metadata"`
	TempId   string `json:"temp_id"`
	X        int    `db:"x" json:"x"`
	Y        int    `db:"y" json:"y"`
}

type NodeType struct {
	Id          string `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	Project     string `db:"project" json:"project"`
	FillColor   string `db:"fill_color" json:"fill_color"`
	StrokeColor string `db:"stroke_color" json:"stroke_color"`
	Metadata    string `db:"metadata" json:"metadata"`
	StrokeWidth uint8  `db:"stroke_width" json:"stroke_width"`
	Shape       uint8  `db:"shape" json:"shape"`
}

type Edge struct {
	Id      string `db:"id" json:"id"`
	TempId  string `json:"temp_id"`
	StartId string `db:"start_id" json:"start_id"`
	EndId   string `db:"end_id" json:"end_id"`
	Type    string `db:"type" json:"type"`
	Created string `db:"created" json:"created"`
	Updated string `db:"updated" json:"updated"`
}

type EdgeType struct {
	Id          string `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	Project     string `db:"project" json:"project"`
	StrokeColor string `db:"stroke_color" json:"stroke_color"`
	LineDash    []byte `db:"line_dash" json:"line_dash"`
	Metadata    []byte `db:"metadata" json:"metadata"`
	StrokeWidth uint8  `db:"stroke_width" json:"stroke_width"`
}

type Permission uint8

const (
	P_EDIT_CONNECTION Permission = 1 << iota
	P_EDIT_NODES
	P_MANAGE_PROJECT
)

func HasPermission(conf uint8, flag uint8) bool {
	return conf&flag != 0
}

type PermissionConfig struct {
	EditConnection bool `db:"edit_connection" json:"edit_connection"`
	EditNodes      bool `db:"edit_nodes" json:"edit_nodes"`
	ManageProject  bool `db:"manage_project" json:"manage_project"`
}

type Project struct {
	Permissions Permission `db:"permissions" json:"permissions"`
	Id          string     `db:"id" json:"id"`
	Owner       string     `db:"owner" json:"owner"`
	Name        string     `db:"name" json:"name"`
	Updated     string     `db:"updated" json:"updated"`
	Created     string     `db:"created" json:"created"`
}

func GetNodeTypes(app *pocketbase.PocketBase) *[]NodeType {
	node_types := []NodeType{}

	app.DB().
		Select("*").
		From("default_node_types").
		All(&node_types)

	return &node_types
}

func GetEdgeTypes(app *pocketbase.PocketBase) *[]EdgeType {
	edge_types := []EdgeType{}

	app.DB().
		Select("*").
		From("default_edge_types").
		All(&edge_types)

	return &edge_types
}
