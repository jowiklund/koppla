import { CanvasGUIDriver } from "@koppla/canvas-driver";
import { NodeShape } from "@koppla/engine";
import wasm_url from '@koppla/engine/public/main.wasm?url';

const edge_types = [
  {
    "id": 0,
    "name": "Access",
    "stroke_color": "#8d99ae",
    "stroke_width": 2,
    "line_dash": [],
    "metadata": '{"access_level": "Access"}'
  },
  {
    "id": 1,
    "name": "Add",
    "stroke_color": "#2a9d8f",
    "stroke_width": 2,
    "line_dash": [8, 6],
    "metadata": '{"access_level": "Add"}'
  },
  {
    "id": 2,
    "name": "Update",
    "stroke_color": "#e9c46a",
    "stroke_width": 2.5,
    "line_dash": [15, 5, 2, 5],
    "metadata": '{"access_level": "Update"}'
  },
  {
    "id": 3,
    "name": "Modify",
    "stroke_color": "#f4a261",
    "stroke_width": 2.5,
    "line_dash": [3, 4],
    "metadata": '{"access_level": "Modify"}'
  },
  {
    "id": 4,
    "name": "Manage",
    "stroke_color": "#519ce7",
    "stroke_width": 3,
    "line_dash": [],
    "metadata": '{"access_level": "Manage"}'
  }
]

/**
 * @enum {number}
 */
const NODE_TYPE = {
  USER: 0,
  GROUP: 1,
  RESOURCE: 2
}


/** @type {Array<import("./modules/graph-editor-api.js").NodeType>} */
const node_types = [
  {
    fill_color: "#6699ff",
    name: "User",
    shape: NodeShape.CIRCLE,
    stroke_color: "#476bb5",
    stroke_width: 2,
    id: NODE_TYPE.USER,
    metadata: ""
  },
  {
    fill_color: "#80b357",
    name: "Group",
    shape: NodeShape.DIAMOND,
    stroke_color: "#608741",
    stroke_width: 2,
    id: NODE_TYPE.GROUP,
    metadata: ""
  },
  {
    fill_color: "#fc8800",
    name: "Resource",
    shape: NodeShape.SQUARE_ROUNDED,
    stroke_color: "#c46b04",
    stroke_width: 2,
    id: NODE_TYPE.RESOURCE,
    metadata: ""
  }
]

const canvas_gui = new CanvasGUIDriver({
  edge_dialog_id: "create-edge-dialog",
  container_id: "canvas-container",
  control_panel_id: "control-panel",
  wasm_url
})

document.addEventListener("DOMContentLoaded", async () => {
  await canvas_gui.run({
    edge_types,
    node_types
  },
    [
      {
        name: "Product owners",
        type: NODE_TYPE.GROUP,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "po"}'
      },
      {
        name: "Developers",
        type: NODE_TYPE.GROUP,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "devs"}'
      },
      {
        name: "Software",
        type: NODE_TYPE.RESOURCE,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "soft"}'
      },
      {
        name: "Projects",
        type: NODE_TYPE.RESOURCE,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "project"}'
      },
      {
        name: "Lasse",
        type: NODE_TYPE.USER,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "usr_lasse"}'
      },
      {
        name: "Lisa",
        type: NODE_TYPE.USER,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "usr_lisa"}'
      },
      {
        name: "Roland",
        type: NODE_TYPE.USER,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "usr_roland"}'
      },
      {
        name: "Berit",
        type: NODE_TYPE.USER,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "usr_berit"}'
      },
      {
        name: "Kajsa",
        type: NODE_TYPE.USER,
        edges_outgoing: [],
        edges_incoming: [],
        metadata: '{"id": "usr_kajsa"}'
      },
    ]
  ).then(graph => {
      graph.on("edge:create", () => {
        console.log(graph.getRelations());
      });
    });
})

