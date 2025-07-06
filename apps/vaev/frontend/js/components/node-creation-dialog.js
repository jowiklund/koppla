import { createEffect } from "@kpla/signals";
import { inputs } from "./styles";

class Element extends HTMLElement {
    /** @type {import("@kpla/signals").Signal} signal  */
    _node_name = null

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.shadowRoot.adoptedStyleSheets = [ inputs ]
        this.shadowRoot.innerHTML = `
            <style>
                dialog {
                    background-color: var(--background-secondary);
                    border: var(--small-border);
                    border-radius: var(--border-radius);
                }
                label {
                    color: var(--text-primary);
                }
            </style>
            <dialog>
                <form method="dialog">
                    <label>Name:
                        <input name="name" type="text" autofocus/>
                    </label>
                </form>
            </dialog>
        `;

        this.dialog = this.shadowRoot.querySelector('dialog');
        this.form = this.shadowRoot.querySelector('form');
        this.name_input = this.shadowRoot.querySelector('input[name="name"]');
        this.name_input.addEventListener("input", (e) => {
            const [_, setName] = this._node_name;
            setName(e.target.value)
        });

        this.form.addEventListener("submit", () => {
            const data = new FormData(this.form)
            const node_name = data.get("name")

            this.dispatchEvent(new CustomEvent("submit", {
                bubbles: false,
                composed: true,
                detail: {
                    name: node_name
                }
            }))

        })
    }

    /** @param {import("@kpla/signals").Signal} signal  */
    set node_name(signal) {
        this._node_name = signal;
        const [name] = signal; 

        createEffect(() => {
            this.name_input.value = name()
        })
    }

    showModal() {
        this.dialog.showModal();
        requestAnimationFrame(() => {
            this.name_input.focus();
            this.name_input.select();
        });
    }
}

customElements.define('node-creation-dialog', Element);
