import { registerToolBox } from "./modules/control-panel.js";
import { getEngine, GraphEditor } from "./modules/graph-editor-api.js";

async function run() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#node-canvas");
  /** @type {HTMLDivElement} */
  const control_panel = document.querySelector("#control-panel");
  const NODE_RADIUS = 20;
  const GRID_SIZE = 20;

  /**
   * @param {number} value 
   * @returns {number}
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
  if (!graph) return;

  registerToolBox(graph, control_panel, canvas, snapToGrid);

  let selection_color = "#089fff";

  let current_mouse_x = 0;
  let current_mouse_y = 0;

  let is_dragging = false;
  const drag_offsets = new Map();

  let is_connecting = false;

  let is_selecting = false;
  let selection_start_x = 0;
  let selection_start_y = 0;

  let scale = 1.0;

  let is_panning = false;
  let pan_start_x = 0;
  let pan_start_y = 0;

  /** @type {Array<import("./modules/graph-editor-api.js").NodeHandle>} */
  let selected_node_handles = [];

  window.addEventListener("keydown", (e) => {
    if (
      (e.key == "Delete" || e.key == "Backspace") &&
        selected_node_handles.length > 0
    ) {
      for (let handle of selected_node_handles) {
        graph.deleteNode(handle);
      }
      selected_node_handles = [];
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();

    const screen_x = e.clientX - rect.left;
    const screen_y = e.clientY - rect.top;

    const world_coords = graph.screenToWorld({x: screen_x, y: screen_y});
    const mouse_x = world_coords.x;
    const mouse_y = world_coords.y;

    const nodes = graph.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = mouse_x - node.x;
      const dy = mouse_y - node.y;

      if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) {
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

    if (e.ctrlKey) {
      is_panning = true;
      pan_start_x = screen_x;
      pan_start_y = screen_y;
      canvas.style.cursor = "move";
      return;
    }

    selected_node_handles = [];
    is_selecting = true;
    selection_start_x = snapToGrid(mouse_x);
    selection_start_y = snapToGrid(mouse_y);
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();

    const screen_x = e.clientX - rect.left;
    const screen_y = e.clientY - rect.top;

    const world_coords = graph.screenToWorld({x: screen_x, y: screen_y})
    const mouse_x = world_coords.x;
    const mouse_y = world_coords.y;

    current_mouse_x = snapToGrid(mouse_x);
    current_mouse_y = snapToGrid(mouse_y);

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

    const world_before = graph.screenToWorld({x: mouse_x, y: mouse_y});

    graph.zoom(zoom)

    const world_after = graph.screenToWorld({x: mouse_x, y: mouse_y});

    graph.pan(
      (world_after.x - world_before.x) * graph.scale,
      (world_after.y - world_before.y) * graph.scale
    )
  });

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

          const dx = mouse_x - node.x;
          const dy = mouse_y - node.y;
          if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) {
            graph.createEdge(handle, end_handle);
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

        drawEdgeOrthogonal(ctx, startCoords, startGate, endCoords, endGate, offset);
      });
    });

    if (is_connecting) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 1;

      for (let handle of selected_node_handles) {
        const start_node = graph.getNode(handle)
        const mouse_coords = { x: current_mouse_x, y: current_mouse_y };
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
          0
        );
      }

      ctx.setLineDash([]);
    }

    const nodes = graph.getNodes();

    for (let node of nodes) {
      const { x, y } = node;
      ctx.beginPath();
      switch(node.type) {
        case graph.GraphNodeType.zone:
          ctx.roundRect(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS*2, NODE_RADIUS*2, [5]);
          ctx.fillStyle = "#66ff99";
          break;
        case graph.GraphNodeType.access_connector:
          ctx.moveTo(x, y - NODE_RADIUS)
          ctx.lineTo(x + NODE_RADIUS, y)
          ctx.lineTo(x, y + NODE_RADIUS)
          ctx.lineTo(x - NODE_RADIUS, y)
          ctx.lineTo(x, y - NODE_RADIUS)
          ctx.fillStyle = "#cecece";
          break;
        case graph.GraphNodeType.group:
          ctx.roundRect(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS*2, NODE_RADIUS*2, [5]);
          ctx.fillStyle = "#ff9966";
          break;
        case graph.GraphNodeType.coworker:
          ctx.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI);
          ctx.fillStyle = "#6699ff";
          break;
      }
      ctx.fill();
      if (selected_node_handles.includes(node.handle)) {
        ctx.strokeStyle = selection_color;
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = "#000"
        ctx.lineWidth = 2;
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
  // --- 1. Calculate the visible part of the world ---
  // This is essential to only draw what's currently on screen.
  const worldViewTopLeft = graph.screenToWorld({x: 0, y: 0});
  const worldViewBottomRight = graph.screenToWorld({x: canvasWidth, y: canvas_height});

  // --- 2. Align the loop start to the grid ---
  // This ensures the grid remains stable and doesn't "swim" when you pan.
  // It finds the first multiple of GRID_SIZE just off-screen to the top-left.
  const startX = Math.floor(worldViewTopLeft.x / grid_size) * grid_size;
  const startY = Math.floor(worldViewTopLeft.y / grid_size) * grid_size;

  // --- 3. Keep the dot size visually constant ---
  // To make the dots always appear to be 1px wide on the screen,
  // we must scale their radius inversely to the current zoom level.
  const dotRadius = 1 / graph.scale;

  ctx.fillStyle = "#ebebeb";
  
  // Loop from the calculated start of the visible area to the end
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
 */
function drawEdgeOrthogonal(ctx, startCoords, startGate, endCoords, endGate, offset) {
  const cornerRadius = 10;
  const bundleGap = 10;
  const offsetAmount = offset * bundleGap;
  const sx = startCoords.x;
  const sy = startCoords.y;
  const ex = endCoords.x;
  const ey = endCoords.y;

  ctx.beginPath();
  ctx.moveTo(sx, sy);

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

run();
