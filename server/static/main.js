/**
 * @typedef {Object} Coord
 * @property {number} x
 * @property {number} y
 */

import { registerToolBox } from "./modules/control-panel.js";
import { getEngine } from "./modules/graph-editor-api.js";

async function run() {
  const canvas = document.getElementById("node-canvas");
  const control_panel = document.getElementById("control-panel");
  const NODE_RADIUS = 20;
  const GRID_SIZE = 20;

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

  let is_dragging = false;
  let dragged_node_handle = 0;
  let drag_offset_x = 0;
  let drag_offset_y = 0;

  let is_connecting = false;
  let connection_start_handle = 0;
  let current_mouse_x = 0;
  let current_mouse_y = 0;

  let selected_node_handle = 0;

  window.addEventListener("keydown", (e) => {
    if (
      (e.key == "Delete" || e.key == "Backspace") &&
        selected_node_handle != 0
    ) {
      console.log(`Deleting node: ${selected_node_handle}`);
      graph.deleteNode(selected_node_handle);
      selected_node_handle = 0;
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    selected_node_handle = 0;

    const nodes = graph.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = mouseX - node.x;
      const dy = mouseY - node.y;

      if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) {
        selected_node_handle = node.handle;
        if (e.shiftKey) {
          is_connecting = true;
          connection_start_handle = node.handle;
        } else {
          is_dragging = true;
          dragged_node_handle = node.handle;
          drag_offset_x = dx;
          drag_offset_y = dy;
          canvas.style.cursor = "grabbing";
        }
        return;
      }
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    current_mouse_x = mouseX;
    current_mouse_y = mouseY;

    if (is_dragging) {
      const newX = snapToGrid(mouseX - drag_offset_x);
      const newY = snapToGrid(mouseY - drag_offset_y);
      graph.setNodePosition(dragged_node_handle, newX, newY);
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    if (is_connecting) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      for (let node of graph.getNodes()) {
        const end_handle = node.handle;
        if (end_handle == connection_start_handle) continue;

        const dx = mouseX - node.x;
        const dy = mouseY - node.y;
        if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) {
          graph.createEdge(connection_start_handle, end_handle);
          break;
        }
      }
    }
    is_dragging = false;
    is_connecting = false;
    dragged_node_handle = 0;
    canvas.style.cursor = "default";
  });

  function draw() {
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    ctx.fillStyle = "#ebebeb";
    for (let x = GRID_SIZE; x < logicalWidth; x += GRID_SIZE) {
      for (let y = GRID_SIZE; y < logicalHeight; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

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

      const start_node = graph.getNode(connection_start_handle)
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
          ctx.roundRect(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS*2, NODE_RADIUS*2, [5]);
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
      if (node.handle === selected_node_handle) {
        ctx.strokeStyle = "#089fff";
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

    requestAnimationFrame(draw);
  }

  draw();
}

const GATES = {
  TOP: 0,
  BOTTOM: 1,
  LEFT: 2,
  RIGHT: 3
};

/**
 * Determines the best exit and entry gates for a connection
 * based on the relative position of two nodes.
 * @param {{x: number, y: number}} startNode The start node's coordinates.
 * @param {{x: number, y: number}} endNode The end node's coordinates.
 * @returns {{startGate: string, endGate: string}}
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
 * @param {{x: number, y: number}} node The node's center coordinates.
 * @param {string} gate The gate (from GATES enum).
 * @param {number} radius The node's radius.
 * @returns {{x: number, y: number}}
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
 * @param {CanvasRenderingContext2D} ctx The canvas context.
 * @param {Coord} startCoords
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
}

run();
