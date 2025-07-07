import { createEffect } from "@kpla/signals";
import { material_symbols } from "./styles";

class Element extends HTMLElement {
    /** @type {import("@kpla/signals").Signal} signal  */
    _current_tool = null;
    /** @type {Map<string, HTMLInputElement>} */
    _input_map = new Map();

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.shadowRoot.adoptedStyleSheets = [ material_symbols ]
        this.shadowRoot.innerHTML = `
            <style>
                .toolbar {
                    position: absolute;
                    top: 1rem;
                    left: 1rem;
                    display: flex;
                    flex-direction: column;
                    z-index: var(--layer-4);
                }

                .toolbar label:hover {
                    background-color: var(--background-primary);
                }

                .toolbar label:first-child {
                    border-top-left-radius: var(--border-radius-small);
                    border-top-right-radius: var(--border-radius-small);
                    border-bottom: none;
                }
                .toolbar label:last-child {
                    border-bottom-left-radius: var(--border-radius-small);
                    border-bottom-right-radius: var(--border-radius-small);
                    border-top: none;
                }

                .toolbar label.active {
                  background-color: var(--accent-color);
                }

                .toolbar input {
                    position: absolute;
                    opacity: 0;
                    cursor: pointer;
                }

                .toolbar label {
                    cursor: pointer;
                    position: relative;
                    box-sizing: border-box;
                    background-color:var(--background-secondary);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: var(--gap-3);
                    font-size: .8rem;
                    border: var(--small-border);
                    color: var(--text-primary);
                    transition: all .1s;
                }
            </style>
                <div class="toolbar">
                    <label title="(1) : cursor">
                        <input checked="checked" type="radio" value="0" name="tool" />
                        <span class="material-symbols fill">arrow_selector_tool</span>
                    </label>
                    <label title="(2) : connect nodes">
                        <input type="radio" value="1" name="tool"/>
                        <span class="material-symbols fill">mediation</span>
                    </label>
                    <label title="(3) : create nodes">
                        <input type="radio" value="2" name="tool"/>
                        <span class="material-symbols fill">control_point_duplicate</span>
                    </label>
                    <label title="(4) : pan">
                        <input type="radio" value="3" name="tool"/>
                        <span class="material-symbols fill">drag_pan</span>
                    </label>
                </div>
        `;

        this.inputs = this.shadowRoot.querySelectorAll('input[type="radio"]');
        for (const input of this.inputs) {
            input.addEventListener("input", (e) => {
                const [tool, setTool] = this._current_tool;
                this._prev_tool = tool();
                console.log(this._prev_tool)
                setTool(e.target.value);
            })
        }

        window.addEventListener("keydown", (e) => {
            const [_, setTool] = this._current_tool;
            switch(e.key) {
                case '1':
                    setTool(0);
                    break;
                case '2':
                    setTool(1);
                    break;
                case '3':
                    setTool(2);
                    break;
                case '4':
                    setTool(3);
                    break;
            }
        })
    }

    /** @param {import("@kpla/signals").Signal} signal  */
    set current_tool(signal) {
        this._current_tool = signal;

        createEffect(() => {
            const [tool] = this._current_tool;
            for (const input of this.inputs) {
                if (input.value == tool()) {
                    input.parentElement.classList.add("active")
                    input.checked = true;
                    continue;
                }
                input.parentElement.classList.remove("active")
                input.checked = false;
            }
        })
    }
}

customElements.define('graph-toolbar', Element);
