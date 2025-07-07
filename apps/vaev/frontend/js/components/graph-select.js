import { inputs } from "./styles"
class Element extends HTMLElement {
    icon;
    disabled = false;
    graph_action;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.shadowRoot.adoptedStyleSheets = [ inputs ]

        this.shadowRoot.innerHTML = `
            <style>
                select {
                    display: block;
                    width: 100%;
                }
            </style>
            <select></select>
            <slot></slot>
        `;

        this.select = this.shadowRoot.querySelector("select")
        this.select.addEventListener(
            "input",
            (e) => {
                const name = this.getAttribute("name");
                this.dispatchEvent(new CustomEvent('graph-select', {
                    bubbles: true,
                    composed: true,
                    detail: { [name]: e.target.value }
                }));
            }
        )
        if (!this.hasAttribute("name")) {
            throw new Error("Missing graph-select attribure 'name'")
        }
        this.shadowRoot.addEventListener('slotchange', () => {
            let node = this.querySelector('option')
            node && this.select.append( node )
        })
    }
}

customElements.define('graph-select', Element);
