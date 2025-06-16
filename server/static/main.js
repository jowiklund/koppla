import { assert_is_dialog, assert_is_form, assert_is_not_null } from "./modules/assert.js";
import { registerToolBox } from "./modules/control-panel.js";
import { getEngine, GraphEditor, NodeShape } from "./modules/graph-editor-api.js";

const edge_types = [
  {
    "id": 0,
    "name": "Access",
    "stroke_color": "#8d99ae",
    "stroke_width": 2,
    "line_dash": [],
    "metadata": ""
  },
  {
    "id": 1,
    "name": "Add",
    "stroke_color": "#2a9d8f",
    "stroke_width": 2,
    "line_dash": [8, 6],
    "metadata": ""
  },
  {
    "id": 2,
    "name": "Update",
    "stroke_color": "#e9c46a",
    "stroke_width": 2.5,
    "line_dash": [15, 5, 2, 5],
    "metadata": ""
  },
  {
    "id": 3,
    "name": "Modify",
    "stroke_color": "#f4a261",
    "stroke_width": 2.5,
    "line_dash": [3, 4],
    "metadata": ""
  },
  {
    "id": 4,
    "name": "Manage",
    "stroke_color": "#519ce7",
    "stroke_width": 3,
    "line_dash": [],
    "metadata": ""
  }
]

/**
 * @enum {number}
 */
const NODE_TYPE = {
  USER: 0,
  GROUP: 1,
  ZONE: 2
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
    shape: NodeShape.SQUARE_ROUNDED,
    stroke_color: "#608741",
    stroke_width: 2,
    id: NODE_TYPE.GROUP,
    metadata: ""
  },
  {
    fill_color: "#fc8800",
    name: "Zone",
    shape: NodeShape.SQUARE_ROUNDED,
    stroke_color: "#c46b04",
    stroke_width: 2,
    id: NODE_TYPE.ZONE,
    metadata: ""
  }
]

/**
 * @typedef Config
 * @property {Array<import("./modules/graph-editor-api.js").EdgeType>} edge_types
 * @property {Array<import("./modules/graph-editor-api.js").NodeType>} node_types
 */

/**
 * @param {Config} config 
 * @param {Array<import("./modules/graph-editor-api.js").NodeBase>} graph_data 
 */
export async function run(config, graph_data) {
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#node-canvas");
  /** @type {HTMLDivElement} */
  const control_panel = document.querySelector("#control-panel");
  const NODE_RADIUS = 20;
  const GRID_SIZE = 20;

  /**
   * @type {import("./modules/control-panel.js").CoordinateRounder}
   */
  function snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  /** @type {CanvasRenderingContext2D} */
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.scale(dpr, dpr);

  const graph = await getEngine();
  assert_is_not_null(graph);

  graph.coordinate_rounder = snapToGrid;

  for (let type of config.edge_types) {
    graph.setEdgeType(type);
  }

  for (let type of config.node_types) {
    graph.setNodeType(type);
  }

  registerToolBox(graph, control_panel, canvas, snapToGrid);

  graph.loadGraph(graph_data)

  let selection_color = "#089fff";

  let current_mouse_x = 0;
  let current_mouse_y = 0;

  let is_dragging = false;
  const drag_offsets = new Map();

  let is_connecting = false;

  let is_selecting = false;
  let selection_start_x = 0;
  let selection_start_y = 0;

  let is_panning = false;
  let pan_start_x = 0;
  let pan_start_y = 0;

  /** @type {Array<import("./modules/graph-editor-api.js").NodeHandle>} */
  let selected_node_handles = [];

  window.addEventListener("keydown", (e) => {
    if (
      (e.key == "Delete") &&
        selected_node_handles.length > 0
    ) {
      for (let handle of selected_node_handles) {
        graph.deleteNode(handle);
      }
      selected_node_handles = [];
    }

    if (e.key == "Backspace" && selected_node_handles.length > 0) {
      for (let handle of selected_node_handles) {
        graph.deleteOutgoing(handle)
      }
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();

    const screen_x = e.clientX - rect.left;
    const screen_y = e.clientY - rect.top;

    const world_coords = graph.screenToWorld({x: screen_x, y: screen_y}, false);
    const mouse_x = world_coords.x;
    const mouse_y = world_coords.y;

    if (e.ctrlKey) {
      is_panning = true;
      pan_start_x = screen_x;
      pan_start_y = screen_y;
      canvas.style.cursor = "move";
      return;
    }

    const nodes = graph.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = Math.abs(mouse_x - node.x);
      const dy = Math.abs(mouse_y - node.y);

      if (dx <= NODE_RADIUS && dy <= NODE_RADIUS) {
        if (!selected_node_handles.includes(node.handle)) {
          selected_node_handles = [node.handle]
        }
        if (e.shiftKey) {
          is_connecting = true;
        } else {
          is_dragging = true;
          drag_offsets.clear();
          for (let handle of selected_node_handles) {
            const node = graph.getNode(handle);
            const dx = mouse_x - node.x;
            const dy = mouse_y - node.y;
            drag_offsets.set(handle, {dx, dy})
          }
          canvas.style.cursor = "grabbing";
        }
        return;
      }
    }

    selected_node_handles = [];
    is_selecting = true;
    selection_start_x = mouse_x;
    selection_start_y = mouse_y;
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();

    const screen_x = e.clientX - rect.left;
    const screen_y = e.clientY - rect.top;

    const world_coords = graph.screenToWorld({x: screen_x, y: screen_y}, false)
    const mouse_x = world_coords.x;
    const mouse_y = world_coords.y;

    current_mouse_x = mouse_x;
    current_mouse_y = mouse_y;

    if (is_dragging) {
      for (let [handle, offset] of drag_offsets.entries()) {
        const new_x = snapToGrid(mouse_x - offset.dx);
        const new_y = snapToGrid(mouse_y - offset.dy);
        graph.setNodePosition(handle, new_x, new_y);
      }
    }

    if (is_panning) {
      const screen_x = e.clientX - rect.left;
      const screen_y = e.clientY - rect.top;

      const dx = screen_x - pan_start_x;
      const dy = screen_y - pan_start_y;

      graph.pan(dx, dy);

      pan_start_x = screen_x;
      pan_start_y = screen_y;
      return;
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    const zoom_intensity = 0.05;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoom_intensity);

    const rect = canvas.getBoundingClientRect();
    const mouse_x = e.clientX - rect.left;
    const mouse_y = e.clientY - rect.top;

    const world_before = graph.screenToWorld({x: mouse_x, y: mouse_y}, false);

    graph.zoom(zoom)

    const world_after = graph.screenToWorld({x: mouse_x, y: mouse_y}, false);

    graph.pan(
      (world_after.x - world_before.x) * graph.scale,
      (world_after.y - world_before.y) * graph.scale
    )
  });

  const edge_type_select = document.getElementById("edge-type-select")
  for (let edge of graph.edge_types.values()) {
    const option = document.createElement("option")
    option.value = `${edge.id}`;
    option.innerHTML = edge.name;
    edge_type_select.appendChild(option);
  }

  const edge_type_dialog = document.getElementById("create-edge-dialog");
  assert_is_dialog(edge_type_dialog)

  let new_edges = [];
  document.getElementById("create-edge-form").addEventListener("submit", (event) => {
    assert_is_form(event.target);
    const data = new FormData(event.target);
    const event_type = parseInt(data.get("type").toString())
    for (let i = 0; i < new_edges.length; i++) {
        graph.createEdge(new_edges[i].start_handle, new_edges[i].end_handle, event_type);
    }
    new_edges = [];
  })

  canvas.addEventListener("mouseup", (e) => {
    if (is_connecting) {
      const rect = canvas.getBoundingClientRect();
      const screen_x = e.clientX - rect.left;
      const screen_y = e.clientY - rect.top;

      const world_coords = graph.screenToWorld({x: screen_x, y: screen_y});
      const mouse_x = world_coords.x;
      const mouse_y = world_coords.y;

      for (let handle of selected_node_handles) {
        for (let node of graph.getNodes()) {
          const end_handle = node.handle;
          if (end_handle == handle) continue;

          const dx = Math.abs(mouse_x - node.x);
          const dy = Math.abs(mouse_y - node.y);

          if (dx <= NODE_RADIUS && dy <= NODE_RADIUS) {
            new_edges.push({
              start_handle: handle,
              end_handle 
            })
            edge_type_dialog.showModal();
            break;
          }
        }
      }

    }

    is_dragging = false;
    is_connecting = false;
    is_panning = false;
    canvas.style.cursor = "default";

    if (is_selecting) {
      const min_x = Math.min(selection_start_x, current_mouse_x);
      const max_x = Math.max(selection_start_x, current_mouse_x);
      const min_y = Math.min(selection_start_y, current_mouse_y);
      const max_y = Math.max(selection_start_y, current_mouse_y);

      for (let node of graph.getNodes()) {
        const inside_x = (node.x >= min_x && node.x <= max_x);
        const inside_y = (node.y >= min_y && node.y <= max_y);
        if (inside_x && inside_y) {
          selected_node_handles.push(node.handle);
        }
      }

      is_selecting = false;
    }
  });

  function draw() {
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    ctx.save();
    ctx.translate(graph.pan_coords.x, graph.pan_coords.y);
    ctx.scale(graph.scale, graph.scale);

    drawWorldGrid(
      ctx,
      logicalWidth,
      logicalHeight,
      GRID_SIZE,
      graph
    );

    const edge_bundles = graph.getEdgeBundles();

    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;

    edge_bundles.forEach(bundle => {
      const bundleSize = bundle.length;
      const initialOffset = -(bundleSize - 1) / 2.0;

      bundle.forEach((edge, index) => {
        const start_node = graph.getNode(edge.start_handle);
        const end_node = graph.getNode(edge.end_handle);

        const { startGate, endGate } = getBestGates({
          y: start_node.y,
          x: start_node.x,
        }, {
          y: end_node.y,
          x: end_node.x
        });

        const startCoords = getGateCoordinates(start_node, startGate, NODE_RADIUS);
        const endCoords = getGateCoordinates(end_node, endGate, NODE_RADIUS);

        const offset = initialOffset + index;

        drawEdgeOrthogonal(
          ctx,
          startCoords,
          startGate,
          endCoords,
          endGate,
          offset,
          graph.getEdgeType(edge.type)
        );
      });
    });

    if (is_connecting) {
      for (let handle of selected_node_handles) {
        const start_node = graph.getNode(handle)
        const mouse_coords = {
          x: snapToGrid(current_mouse_x),
          y: snapToGrid(current_mouse_y)
        };
        const { startGate, endGate } = getBestGates(
          {
            x: start_node.x,
            y: start_node.y
          }, mouse_coords);
        const startCoords = getGateCoordinates(start_node, startGate, NODE_RADIUS);

        drawEdgeOrthogonal(
          ctx,
          startCoords,
          startGate,
          mouse_coords,
          endGate,
          0,
          {
            line_dash: [5,5],
            metadata: "",
            stroke_width: 1,
            stroke_color: "#888888",
            name: "",
            id: 0
          }
        );
      }
    }

    const nodes = graph.getNodes();

    for (let node of nodes) {
      const { x, y } = node;
      ctx.beginPath();
      const type = graph.getNodeType(node.type);
      switch (type.shape) {
        case NodeShape.CIRCLE:
          ctx.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI);
          break;
        case NodeShape.DIAMOND:
          ctx.moveTo(x, y - NODE_RADIUS)
          ctx.lineTo(x + NODE_RADIUS, y)
          ctx.lineTo(x, y + NODE_RADIUS)
          ctx.lineTo(x - NODE_RADIUS, y)
          ctx.lineTo(x, y - NODE_RADIUS)
          break;
        case NodeShape.SQUARE:
          ctx.rect(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS*2, NODE_RADIUS*2);
          break;
        case NodeShape.SQUARE_ROUNDED:
          ctx.roundRect(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS*2, NODE_RADIUS*2, [5]);
          break;
      }
      ctx.fillStyle = type.fill_color;
      ctx.fill();
      if (selected_node_handles.includes(node.handle)) {
        ctx.strokeStyle = selection_color;
        ctx.lineWidth = 4;
      } else {
        ctx.lineWidth = type.stroke_width;
        ctx.strokeStyle = type.stroke_color;
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = "#fff";
      ctx.rect(x - (node.name.length / 2) * 8, y + NODE_RADIUS + 5, node.name.length * 8, 20);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.name, x, y + NODE_RADIUS + 10);
    }

    if (is_selecting) {
      ctx.beginPath(); //#089fff
      ctx.strokeStyle = selection_color;
      ctx.fillStyle = `rgba(8, 190, 255, 0.1)`
      ctx.moveTo(selection_start_x, selection_start_y);
      ctx.lineTo(selection_start_x, current_mouse_y);
      ctx.lineTo(current_mouse_x, current_mouse_y);
      ctx.lineTo(current_mouse_x, selection_start_y);
      ctx.lineTo(selection_start_x, selection_start_y);
      ctx.stroke();
      ctx.fill();
    }

    ctx.restore();
    requestAnimationFrame(draw);
  }

  draw();
}

/**
 * @param {CanvasRenderingContext2D} ctx The canvas context.
 * @param {number} canvasWidth The width of the canvas element.
 * @param {number} canvas_height The height of the canvas element.
 * @param {GraphEditor} graph 
 * @param {number} grid_size 
 */
function drawWorldGrid(ctx, canvasWidth, canvas_height, grid_size, graph) {
  const worldViewTopLeft = graph.screenToWorld({x: 0, y: 0});
  const worldViewBottomRight = graph.screenToWorld({x: canvasWidth, y: canvas_height});

  const startX = Math.floor(worldViewTopLeft.x / grid_size) * grid_size;
  const startY = Math.floor(worldViewTopLeft.y / grid_size) * grid_size;

  const dotRadius = 1 / graph.scale;

  ctx.fillStyle = "#ebebeb";
  
  for (let x = startX; x < worldViewBottomRight.x; x += grid_size) {
    for (let y = startY; y < worldViewBottomRight.y; y += grid_size) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

/**
 * @typedef {Object} Gates
 * @property {number} TOP
 * @property {number} BOTTOM
 * @property {number} LEFT
 * @property {number} RIGHT
 */

/** @type Gates */
const GATES = {
  TOP: 0,
  BOTTOM: 1,
  LEFT: 2,
  RIGHT: 3
};

/**
 * Determines the best exit and entry gates for a connection
 * based on the relative position of two nodes.
 * @param {import("./modules/typedefs.js").Coords} startNode The start node's coordinates.
 * @param {import("./modules/typedefs.js").Coords} endNode The end node's coordinates.
 * @returns {{startGate: number, endGate: number}}
 */
function getBestGates(startNode, endNode) {
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
            return { startGate: GATES.RIGHT, endGate: GATES.LEFT };
        } else {
            return { startGate: GATES.LEFT, endGate: GATES.RIGHT };
        }
    } else {
        if (dy > 0) {
            return { startGate: GATES.BOTTOM, endGate: GATES.TOP };
        } else {
            return { startGate: GATES.TOP, endGate: GATES.BOTTOM };
        }
    }
}

/**
 * @param {import("./modules/typedefs.js").Coords} node The node's center coordinates.
 * @param {number} gate The gate (from GATES enum).
 * @param {number} radius The node's radius.
 * @returns {import("./modules/typedefs.js").Coords}
 */
function getGateCoordinates(node, gate, radius) {
    switch (gate) {
        case GATES.TOP:    return { x: node.x, y: node.y - radius };
        case GATES.BOTTOM: return { x: node.x, y: node.y + radius };
        case GATES.LEFT:   return { x: node.x - radius, y: node.y };
        case GATES.RIGHT:  return { x: node.x + radius, y: node.y };
        default:           return node;
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx - 
 * @param {import("./modules/typedefs.js").Coords} startCoords - 
 * @param {number} startGate - 
 * @param {import("./modules/typedefs.js").Coords} endCoords - 
 * @param {number} endGate - 
 * @param {number} offset - 
 * @param {import("./modules/graph-editor-api.js").EdgeType} edge_type 
 */
function drawEdgeOrthogonal(ctx, startCoords, startGate, endCoords, endGate, offset, edge_type) {
  const cornerRadius = 10;
  const bundleGap = 10;
  const offsetAmount = offset * bundleGap;
  const sx = startCoords.x;
  const sy = startCoords.y;
  const ex = endCoords.x;
  const ey = endCoords.y;

  ctx.beginPath();
  ctx.moveTo(sx, sy);

  ctx.strokeStyle = edge_type.stroke_color;
  ctx.lineWidth = edge_type.stroke_width;

  if (edge_type.line_dash.length > 0) {
    ctx.setLineDash(edge_type.line_dash)
  }

  const isHorizontalStart = startGate === GATES.LEFT || startGate === GATES.RIGHT;
  const isHorizontalEnd = endGate === GATES.LEFT || endGate === GATES.RIGHT;

  if (isHorizontalStart && isHorizontalEnd) {
    const midX = sx + (ex - sx) / 2 + offsetAmount;
    ctx.arcTo(midX, sy, midX, ey, cornerRadius);
    ctx.arcTo(midX, ey, ex, ey, cornerRadius);
  } else if (!isHorizontalStart && !isHorizontalEnd) {
    const midY = sy + (ey - sy) / 2 + offsetAmount;
    ctx.arcTo(sx, midY, ex, midY, cornerRadius);
    ctx.arcTo(ex, midY, ex, ey, cornerRadius);
  } else {
    if (isHorizontalStart) {
      const elbowX = ex;
      const elbowY = sy;
      ctx.arcTo(elbowX, elbowY, ex, ey, cornerRadius);
    } else {
      const elbowX = sx;
      const elbowY = ey;
      ctx.arcTo(elbowX, elbowY, ex, ey, cornerRadius);
    }
  }

  ctx.lineTo(ex, ey);
  ctx.stroke();

  ctx.beginPath();
  ctx.setLineDash([])
  if (startGate === GATES.LEFT) {
    ctx.moveTo(sx - 15, sy - 5);
    ctx.lineTo(sx - 20, sy);
    ctx.lineTo(sx - 15, sy + 5);
  }

  if (startGate === GATES.RIGHT) {
    ctx.moveTo(sx + 15, sy - 5);
    ctx.lineTo(sx + 20, sy);
    ctx.lineTo(sx + 15, sy + 5);
  }

  if (startGate === GATES.TOP) {
    ctx.moveTo(sx - 5, sy - 15);
    ctx.lineTo(sx, sy - 20);
    ctx.lineTo(sx + 5, sy - 15);
  }

  if (startGate === GATES.BOTTOM) {
    ctx.moveTo(sx - 5, sy + 35);
    ctx.lineTo(sx, sy + 40);
    ctx.lineTo(sx + 5, sy + 35);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.stroke();
}

run(
  {
    edge_types,
    node_types
  },
  [
    {
      name: "Developers",
      type: NODE_TYPE.GROUP,
      edges_outgoing: [],
      edges_incoming: []
    },
    {
      name: "Software",
      type: NODE_TYPE.ZONE,
      edges_outgoing: [],
      edges_incoming: []
    },
    {
      name: "Lasse",
      type: NODE_TYPE.USER,
      edges_outgoing: [],
      edges_incoming: []
    }
  ],
);
