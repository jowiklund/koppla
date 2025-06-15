import { assert_is_dialog, assert_is_form, assert_is_input, assert_is_string } from "./assert.js";
import { assert_is_coworker_auth, assert_is_zonetype, GraphEditor } from "./graph-editor-api.js";
/**
 * @callback CoordinateRounder
 * @param {number} value
 * @returns {number}
 */

/** 
 * @typedef {Object} NodeData
 * @property {unknown} data
 * @property {number} type
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

  const modal_ids = new Map()
  modal_ids.set(graph.GraphNodeType.zone, "create-zone-dialog")
  modal_ids.set(graph.GraphNodeType.group, "create-group-dialog")
  modal_ids.set(graph.GraphNodeType.access_connector, "create-access-node-dialog")
  modal_ids.set(graph.GraphNodeType.coworker, "create-coworker-dialog")

  document.getElementById("create-zone-form").addEventListener("submit", (event) => {
    assert_is_zonetype(node_data.data, graph);
    assert_is_form(event.target);
    const data = new FormData(event.target)
    graph.createZoneNode(x, y, data.get("name").toString(), node_data.data)
    event.target.querySelectorAll('input[type="text"]').forEach(el => {
      assert_is_input(el);
      el.value = "";
    })
  })

  document.getElementById("create-group-form").addEventListener("submit", (e) => {
    assert_is_form(e.target);
    const data = new FormData(e.target)
    graph.createGroupNode(x, y, data.get("name").toString())
    e.target.querySelectorAll('input[type="text"]').forEach(el => {
      assert_is_input(el);
      el.value = "";
    })
  })

  document.getElementById("create-coworker-form").addEventListener("submit", (e) => {
    assert_is_form(e.target);
    assert_is_coworker_auth(node_data.data, graph)
    const data = new FormData(e.target)
    graph.createCoworkerNode(x, y, data.get("name").toString(), node_data.data)
    e.target.querySelectorAll('input[type="text"]').forEach(el => {
      assert_is_input(el);
      el.value = "";
    })
  })

  document.getElementById("create-access-node-form").addEventListener("submit", (e) => {
    assert_is_form(e.target);
    const data = new FormData(e.target)
    const access_level = data.get("access_level")
    assert_is_string(access_level)
    graph.createAccessNode(x, y, parseInt(access_level))
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

    const dialog = document.getElementById(modal_ids.get(node_data.type))
    assert_is_dialog(dialog);
    dialog.showModal()
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
 * Creates a button
 * 
 * @param {string} text 
 * @param {NodeData} data
 */
function createNodeDraggable(text, data) {
  const node = document.createElement("div");
  node.innerHTML = text;

  node.classList.add("node-draggable")

  node.setAttribute("draggable", "true")

  node.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("graph/node", JSON.stringify(data))
  })

  return node;
}
