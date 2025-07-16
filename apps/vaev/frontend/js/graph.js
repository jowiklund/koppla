import { CanvasGUIDriver } from "@kpla/canvas-driver"
import wasm_url from '@kpla/engine/public/main.wasm?url';
export { PBStore } from "./PBStore.js";
export { CSVWriter } from "./CSVWriter.js";

import "./components/graph-btn.js"
import "./components/graph-coords.js"
import "./components/graph-select.js"
import "./components/node-creation-dialog.js"
import "./components/toolbar.js"
import { ControlPanel } from "./control-panel.js";

export const driver = new CanvasGUIDriver({
    container_id: "canvas-container",
    control_panel_id: "control-panel",
    wasm_url
})

export const control_panel = new ControlPanel({
    driver,
    root: document.getElementById("control-panel")
})
