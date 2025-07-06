import { material_symbols } from "./styles"
class Element extends HTMLElement {
    icon;
    disabled = false;
    graph_action;

    static get observedAttributes() {
        return ["icon", "disabled"];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.shadowRoot.adoptedStyleSheets = [ material_symbols ]

        this.shadowRoot.innerHTML = `
            <style>
                button {
                    height: var(--gap-8);
                    width: var(--gap-8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: .5rem;
                    background-color: var(--background-primary);
                    color: var(--text-primary);
                    transition: all .1s ease-in-out;
                    border: 1px solid var(--text-secondary);
                    border-radius: var(--border-radius-small);
                    cursor: pointer;
                }

                button:hover {
                    background-color: var(--background-secondary):
                }

                button:disabled {
                    color: var(--text-secondary);
                    background-color: var(--background-accent);
                    cursor: default;
                }

                button .material-symbols {
                    font-variation-settings: "GRAD" 70;
                    font-size: 1.2em;
                }
            </style>
            <button><span class="material-symbols">${this.icon}</span></button>
        `;

        this.button = this.shadowRoot.querySelector("button")
        this.button.addEventListener(
            "click",
            this._handleClick.bind(this)
        )
    }

    attributeChangedCallback(name, _, newValue) {
        switch (name) {
            case "icon":
                this.icon = newValue;
                break;
            case "disabled":
                this.disabled = this.hasAttribute("disabled");
                break;
        }
        this._render();
    }
    connectedCallback() {
        if (this.hasAttribute('icon') && !this.icon) {
            this.icon = this.getAttribute('icon');
        }
        this.disabled = this.hasAttribute('disabled');
        this._render();
    }

    _handleClick() {
        if (this.disabled) return;
        const action = this.getAttribute("action")
        if (!action) {
            throw new Error("No graph action defined");
        }

        this.dispatchEvent(new CustomEvent('graph-action', {
            bubbles: true,
            composed: true,
            detail: { action }
        }));
    }

    _render() {
        this.shadowRoot.querySelector(".material-symbols").innerHTML = this.icon;
        this.button.disabled = this.disabled;
    }
}

customElements.define('graph-btn', Element);
