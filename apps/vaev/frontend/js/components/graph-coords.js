import { createEffect } from "@kpla/signals";

class Element extends HTMLElement {
    /** @type {import("@kpla/signals").Signal<import("@kpla/canvas-driver").PositionData>} signal  */
    _position = null

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.shadowRoot.innerHTML = `
            <style>
                div {
                    color: var(--text-secondary);
                    z-index: 400;
                    position: fixed;
                    bottom: var(--gap-4);
                    left: var(--gap-4);
                    font-size: .8rem;
                }
            </style>
            <div></div>
        `;

        this.div = this.shadowRoot.querySelector('div');
    }

    /** @param {import("@kpla/signals").Signal<import("@kpla/canvas-driver").PositionData>} signal  */
    set position(signal) {
        this._position = signal;
        const [pos] = signal; 

        createEffect(() => {
            const position = pos();
            if (position) {
                const x = Math.floor(position.mouse.x);
                const y = Math.floor(position.mouse.y);
                const { node } = position;
                if (node) {
                    this.div.innerHTML = `x: ${x}, y: ${y} - ${node.name} (${node.id})`
                    return;
                }
                this.div.innerHTML = `x: ${x}, y: ${y}`
            }
        })
    }
}

customElements.define('graph-coords', Element);
