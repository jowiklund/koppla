import { CanvasGUIDriver } from "@kpla/canvas-driver"
import { createEffect, createSignal } from "@kpla/signals";

/**
 * @typedef {Object} Props
 * @property {CanvasGUIDriver} driver
 * @property {HTMLElement} root
 */

export class ControlPanel {
    /** @type {CanvasGUIDriver} */
    driver;
    /** @type {HTMLElement} */
    root;
    /** @type {HTMLDialogElement} */
    node_creation_dialog
    /** @type {Signal} */
    node_name
    /** @type {import("@kpla/engine").Node | null} */
    current_node = null;

    /**
     * @param {Props} props 
     */
    constructor(props) {
        this.driver = props.driver;
        this.root = props.root;

        this.node_name = createSignal("");
        this.node_creation_dialog = document.createElement("node-creation-dialog");
        this.node_creation_dialog.node_name = this.node_name;

        this.root.appendChild(this.node_creation_dialog);

        this._registerListeners()
    }

    _registerListeners() {
        document.addEventListener("graph-action", (e) => {
            this._handleGraphAction(e.detail.action)
        })

        this.driver.on("node:create", (node) => {
            this.current_node = node;
            this.node_creation_dialog.showModal();
        })

        this.node_creation_dialog.addEventListener("submit", (e) => {
            this.current_node.name = e.detail.name;
            if (!this.current_node) return;
            this.driver.graph.createNode(this.current_node);
            const [_, setName] = this.node_name;
        })
    }

    _handleGraphAction(action) {
        switch(action) {
            case "align_horizontal":
                this.driver.alignNodes("horizontal");
                break;
            case "align_vertical":
                this.driver.alignNodes("vertical");
                break;
            case "distribute_horizontal":
                this.driver.distributeNodes("horizontal");
                break;
            case "distribute_vertical":
                this.driver.distributeNodes("vertical");
                break;
            case "sort_force":
                this.driver.graph.sortNodes();
                break;
        }
    }
}
