import { createSignal, createEffect, computed } from "@kpla/signals";

class CounterButton extends HTMLElement {
    #count;
    #doubledCount;
    icon;

    constructor() {
        super();
        this.icon = "";
        this.attachShadow({ mode: 'open' });

        [this.#count, this.setCount] = createSignal(0);
        this.#doubledCount = computed(() => this.#count() * 2);

        this.shadowRoot.innerHTML = `
            <style>
                button {
                    height: 1.8rem;
                    width: 1.8rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: .5rem;
                    background-color: var(--background-primary);
                    color: var(--text-primary);
                    transition: all .1s ease-in-out;
                    border: 1px solid var(--text-secondary);
                    border-radius: 5px;
                }
            </style>
            <button><span class="material-symbols">${this.icon}</span></button>
        `;

        this.button = this.shadowRoot.querySelector('button');
        this.countSpan = this.shadowRoot.querySelector('button span:first-of-type');
        this.doubledCountSpan = this.shadowRoot.querySelector('button span:last-of-type');

        this.button.addEventListener('click', this.increment.bind(this));

        createEffect(() => {
            this.countSpan.textContent = this.#count();
        });
        createEffect(() => {
            this.doubledCountSpan.textContent = this.#doubledCount();
        });
    }

    increment() {
        this.setCount(this.#count() + 1);
    }
}

customElements.define('graph-btn', CounterButton);

