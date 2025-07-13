package layout

import "github.com/a-h/templ"

type ResourceType int

const (
	T_LINK ResourceType = iota
	T_SCRIPT
	T_META
)

type Resource struct {
	Component func() templ.Component
	Type      ResourceType
}

func NewStylesheet(href string) Resource {
	return Resource{
		Component: func() templ.Component {
			return Link("stylesheet", href)
		},
		Type: T_LINK,
	}
}

func NewScript(src string) Resource {
	return Resource{
		Component: func() templ.Component {
			return Script("module", src)
		},
		Type: T_SCRIPT,
	}
}

func NewMeta(name string, content string) Resource {
	return Resource{
		Component: func() templ.Component {
			return Meta(name, content)
		},
		Type: T_META,
	}
}
