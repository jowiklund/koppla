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

        this.current_tool = createSignal(0);
        this.track_keystrokes = createSignal(true);
        this.toolbar = document.createElement("graph-toolbar");
        this.toolbar.current_tool = this.current_tool;
        this.toolbar.track_keystrokes = this.track_keystrokes;

        this.root.appendChild(this.toolbar);

        this.coords = document.createElement("graph-coords");
        this.coords.position = this.driver.current_position;
        this.root.appendChild(this.coords);

        this._registerListeners()


        createEffect(() => {
            const [tool] = this.current_tool;
            this.driver.current_tool = tool();

            for (const section of this.root.querySelectorAll("[tool]")) {
                const val = parseInt(section.getAttribute("tool"))
                if (val < 0) continue;

                if (tool() == val) {
                    section.classList.remove("hide")
                    continue;
                }
                section.classList.add("hide")
            }
        })
    }

    _registerListeners() {
        document.addEventListener("graph-action", (e) => {
            this._handleGraphAction(e.detail.action)
        })

        document.addEventListener("graph-select", (e) => {
            if ("edge_type" in e.detail) {
                this.driver.current_edge_type = e.detail.edge_type;
            }
            if ("node_type" in e.detail) {
                this.driver.current_node_type = e.detail.node_type;
            }
        })

        this.driver.on("node:create", (node) => {
            this.current_node = node;
            const [_, enableToolbarKeystrokes] = this.track_keystrokes;
            enableToolbarKeystrokes(false)
            this.node_creation_dialog.showModal();
        })

        this.node_creation_dialog.addEventListener("submit", (e) => {
            this.current_node.name = e.detail.name;
            if (!this.current_node) return;
            this.driver.graph.createNode(this.current_node);
        })

        this.node_creation_dialog.addEventListener("close", () => {
            const [_, enableToolbarKeystrokes] = this.track_keystrokes;
            enableToolbarKeystrokes(true)
            this.current_node = null;
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
