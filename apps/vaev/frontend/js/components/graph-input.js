class Element extends HTMLElement {
    icon;
    graph_action;

    static get observedAttributes() {
        return ['icon'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.shadowRoot.innerHTML = `
            <style>
            </style>
            <input type="text" />
        `;

        this.shadowRoot.querySelector("button").addEventListener(
            "click",
            this._handleClick.bind(this)
        )
    }

    attributeChangedCallback(name, _, newValue) {
        switch (name) {
            case "icon":
                this.icon = newValue;
                break;
        }
        this._render();
    }
    connectedCallback() {
        if (this.hasAttribute('icon') && !this.icon) {
            this.icon = this.getAttribute('icon');
        }
        this._render();
    }

    _handleClick() {
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
    }
}

customElements.define('graph-btn', Element);

