package layout

import "github.com/a-h/templ"

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
