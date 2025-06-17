import { GraphEditor } from "./graph-editor-api.js";
/**
 * @callback CoordinateRounder
 * @param {number} value
 * @returns {number}
 */

/** 
 * @typedef {Object} NodeData
 * @property {{name: string, color: string}} data
 * @property {number} type
 */

/**
 * @param {GraphEditor} graph 
 * @param {HTMLElement} container 
 * @param {HTMLCanvasElement} canvas
 * @param {CoordinateRounder} coordinate_rounder
 */
export function registerToolBox(graph, container, canvas, coordinate_rounder) {
  const canvas_rect = canvas.getBoundingClientRect();

  /** @type {NodeData} */
  let node_data;
  /** @type {number} */
  let x, y;

  // const modal_ids = new Map()
  //modal_ids.set(graph.GraphNodeType.zone, "create-zone-dialog")

  // document.getElementById("create-zone-form").addEventListener("submit", (event) => {
  //   assert_is_form(event.target);
  //   const data = new FormData(event.target)
  //   const zone_type = parseInt(data.get("type").toString());
  //   assert_is_zonetype(zone_type, graph);
  //   graph.createZoneNode(x, y, data.get("name").toString(), zone_type);
  //   event.target.querySelectorAll('input[type="text"]').forEach(el => {
  //     assert_is_input(el);
  //     el.value = "";
  //   })
  // })
  //

  canvas.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  })

  canvas.addEventListener("drop", (e) => {
    e.preventDefault();
    x = coordinate_rounder(e.clientX - canvas_rect.left);
    y = coordinate_rounder(e.clientY - canvas_rect.top);

    let drop_data = e.dataTransfer.getData("graph/node");
    node_data = JSON.parse(drop_data);

    graph.createNode({
      type: node_data.type,
      name: node_data.data.name,
      edges_incoming: [],
      edges_outgoing: [],
      metadata: ""
    }, x, y)
  })

  for (let [key, style] of graph.node_types) {
    const draggable = createNodeDraggable(style.name, {
      data: {
        name: style.name,
        color: style.fill_color
      },
      type: key
    })
    container.appendChild(draggable);
  }

}

/**
 * Button callback
 *
 * @callback OnClick
 * @param {Event} evt
 * @returns {void}
 */

/**
 * Creates a button
 * 
 * @param {string} text 
 * @param {NodeData} config
 */
function createNodeDraggable(text, config) {
  const node = document.createElement("div");
  node.innerHTML = text;

  node.classList.add("node-draggable")

  node.setAttribute("draggable", "true")
  node.style.borderColor = config.data.color;
  node.style.borderLeftWidth = "8px";

  node.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("graph/node", JSON.stringify(config))
  })

  return node;
}
