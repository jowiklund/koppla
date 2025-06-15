import { GraphEditor } from "./graph-editor-api.js";
/**
 * @callback CoordinateRounder
 * @param {number} value
 * @returns {number}
 */

/**
 * @param {GraphEditor} graph 
 * @param {HTMLDivElement} container 
 * @param {HTMLCanvasElement} canvas
 * @param {CoordinateRounder} coordinate_rounder
 */
export function registerToolBox(graph, container, canvas, coordinate_rounder) {
  const canvas_rect = canvas.getBoundingClientRect();

  /** @type {NodeData} */
  let node_data;
  /** @type {number} */
  let x, y;

  document.getElementById("create-zone-form").addEventListener("submit", (e) => {
    const data = new FormData(e.target)
    graph.createZoneNode(x, y, data.get("name"), node_data)
    e.target.querySelectorAll('input[type="text"]').forEach(el => el.value = "")
  })

  document.getElementById("create-group-form").addEventListener("submit", (e) => {
    const data = new FormData(e.target)
    graph.createGroupNode(x, y, data.get("name"), node_data)
    e.target.querySelectorAll('input[type="text"]').forEach(el => el.value = "")
  })

  document.getElementById("create-coworker-form").addEventListener("submit", (e) => {
    const data = new FormData(e.target)
    graph.createCoworkerNode(x, y, data.get("name"), node_data)
    e.target.querySelectorAll('input[type="text"]').forEach(el => el.value = "")
  })

  document.getElementById("create-access-node-form").addEventListener("submit", (e) => {
    const data = new FormData(e.target)
    graph.createAccessNode(x, y, parseInt(data.get("access_level")))
  })

  const access_level_select = document.getElementById("create-access-node-select")
  for (let key of Object.keys(graph.AccessLevel)) {
    const option = document.createElement("option");
    option.value = graph.AccessLevel[key];
    option.innerHTML = key;
    access_level_select.appendChild(option)
  }

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

    const modal_ids = new Map()
    modal_ids.set(graph.GraphNodeType.zone, "create-zone-dialog")
    modal_ids.set(graph.GraphNodeType.group, "create-group-dialog")
    modal_ids.set(graph.GraphNodeType.access_connector, "create-access-node-dialog")
    modal_ids.set(graph.GraphNodeType.coworker, "create-coworker-dialog")

    document.getElementById(modal_ids.get(node_data.type)).showModal()
  })
  
  const zone = createNodeDraggable("Zone", {
    data: graph.ZoneType.normal,
    type: graph.GraphNodeType.zone
  })

  const group = createNodeDraggable("Group", {
    data: null,
    type: graph.GraphNodeType.group
  })

  const access_node = createNodeDraggable("Access node", {
    data: graph.AccessLevel.modify,
    type: graph.GraphNodeType.access_connector
  })

  const coworker = createNodeDraggable("Coworker", {
    data: graph.CoworkerAuth.internal,
    type: graph.GraphNodeType.coworker
  })

  container.appendChild(zone);
  container.appendChild(group);
  container.appendChild(access_node);
  container.appendChild(coworker);
}

/**
 * Button callback
 *
 * @callback OnClick
 * @param {Event} evt
 * @returns {void}
 */

/**
 * @typedef {Object} NodeData
 * @property {number} type
 * @property {any} data
 */

/**
 * Creates a button
 * 
 * @param {string} text 
 * @param {NodeData} data
 */
function createNodeDraggable(text, data) {
  const node = document.createElement("div");
  node.innerHTML = text;

  node.classList.add("node-draggable")

  node.setAttribute("draggable", true)

  node.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("graph/node", JSON.stringify(data))
  })

  return node;
}
