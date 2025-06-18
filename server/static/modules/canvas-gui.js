/**
 * @typedef RunConfig
 * @property {Array<import("./graph-editor-api.js").EdgeType>} edge_types
 * @property {Array<import("./graph-editor-api.js").NodeType>} node_types
 */

/** 
 * @typedef {Object} NodeData
 * @property {{name: string, color: string}} data
 * @property {number} type
 */

/**
 * @typedef {Object} CanvasDriverOptions
 * @property {string} container_id
 * @property {string} edge_dialog_id
 * @property {string} control_panel_id
 * @property {number} [node_radius]
 * @property {number} [grid_size]
 */

import { assert_is_dialog, assert_is_not_null } from "./assert.js";
import { getEngine, GraphEditor, NodeShape } from "./graph-editor-api.js";
import { createSignal, DocumentParser } from "./signals.js";

export class CanvasGUIDriver {
  /** @type {HTMLElement} */
  container;
  /** @type {HTMLDialogElement} */
  edge_dialog;
  /** @type {HTMLElement} */
  control_panel;
  /** @type {GraphEditor} */
  graph = null;
  /** @type {Promise<GraphEditor>} */
  startup_promise = null;
  dpr = 1;
  drop_x = 0;
  drop_y = 0;
  /** @type {NodeData} */
  drop_data = null;

  /** @type {Map<string, {canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}>} */
  layers = new Map();

  /** @type {DocumentParser} */
  dom = null

  config = {
    grid_size: 20,
    node_radius: 20
  };

  /** @type {Set<import("./graph-editor-api.js").NodeHandle>} */
  moving_nodes = new Set();
  /** @type {Set<import("./graph-editor-api.js").EdgeHandle>} */
  moving_edges = new Set();

  selection_color = "#089fff";

  current_mouse_x = 0;
  current_mouse_y = 0;

  is_dragging = false;
  drag_offsets = new Map();

  is_connecting = false;

  is_selecting = false;
  selection_start_x = 0;
  selection_start_y = 0;

  is_panning = false;
  pan_start_x = 0;
  pan_start_y = 0;

  /** @type {Array<{start_handle: number, end_handle: number}>} */
  new_edges = [];

  /** @type {Array<import("./graph-editor-api.js").NodeHandle>} */
  selected_node_handles = [];

  /**
   * @param {CanvasDriverOptions} opts
   */
  constructor(opts) {
    assert_is_not_null(opts.control_panel_id);
    assert_is_not_null(opts.container_id);
    assert_is_not_null(opts.edge_dialog_id);

    const canvas_container = document.getElementById(opts.container_id);
    assert_is_not_null(canvas_container);
    this.container = canvas_container;

    const canvas_styles = document.createAttribute("style");
    canvas_styles.value = "display: block; position: absolute; inset: 0;"

    Object.assign(this.config, opts);

    this.dpr = window.devicePixelRatio || 1;

    this._createLayer("static");
    this._createLayer("objects");
    this._createLayer("interactions");

    const edge_dialog = document.getElementById(opts.edge_dialog_id);
    assert_is_dialog(edge_dialog)
    this.edge_dialog = edge_dialog;

    const control_panel = document.getElementById(opts.control_panel_id);
    this.control_panel = control_panel;

    this.dom = new DocumentParser()
  }

  /**
   * @param {string} name 
   */
  _createLayer(name) {
    const canvas = document.createElement("canvas");
    const layer_styles = document.createAttribute("style");
    layer_styles.value = "display: block; position: absolute; inset: 0; width: 100%; height: 100%;"

    this.container.appendChild(canvas);

    const rect = this.container.getBoundingClientRect();
    canvas.width = rect.width * this.dpr;
    canvas.height = rect.height * this.dpr;

    canvas.setAttributeNode(layer_styles);

    const ctx = canvas.getContext("2d");
    ctx.scale(this.dpr, this.dpr);

    this.layers.set(name, {
      canvas,
      ctx,
    });
  }

  /**
   * @param {number} value 
   * @private
   */
  _snapToGrid(value) {
    return Math.round(value / this.config.grid_size) * this.config.grid_size;
  }

  /**
 * @param {RunConfig} config 
 * @param {Array<import("./graph-editor-api.js").NodeBase>} graph_data 
 * @returns {Promise<GraphEditor>}
 */
  async run(config, graph_data) {
    this.startup_promise = getEngine();
    this.graph = await this.startup_promise;
    assert_is_not_null(this.graph);
    this.graph.coordinate_rounder = this._snapToGrid.bind(this);

    for (let type of config.edge_types) {
      this.graph.setEdgeType(type);
    }

    for (let type of config.node_types) {
      this.graph.setNodeType(type);
    }

    this._registerControls();
    this._registerSignals();

    this.dom.parse();

    this._drawInteractions()

    this.graph.loadGraph(graph_data);

    this._drawObjects();
    this.graph.on("world:update", this._drawObjects.bind(this));

    this._drawStatic();
    this.graph.on("world:pan", this._drawStatic.bind(this));
    this.graph.on("world:zoom", this._drawStatic.bind(this));
    return this.graph;
  }

  /** @private */
  _registerControls() {
    for (let [key, style] of this.graph.node_types) {
      const draggable = createNodeDraggable(style.name, {
        data: {
          name: style.name,
          color: style.fill_color
        },
        type: key
      })
      this.control_panel.appendChild(draggable);
    }

    window.addEventListener("keydown", this._keydown.bind(this));
    this.container.addEventListener("drop", this._drop.bind(this))
    this.container.addEventListener("mousedown", this._mouseDown.bind(this));
    this.container.addEventListener("mousemove", this._mouseMove.bind(this));
    this.container.addEventListener("wheel", this._wheel.bind(this));
    this.container.addEventListener("mouseup", this._mouseUp.bind(this));

    this.edge_dialog.addEventListener("close", () => {
      this.new_edges = [];
    })

    document.getElementById("create-edge-form")
      .addEventListener("submit", this._createEdges.bind(this))

    this.container.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    })
  }

  _createEdges() {
      const [event_type] = this.dom.signals.get("edge_type");
      for (let i = 0; i < this.new_edges.length; i++) {
        this.graph.createEdge(
          this.new_edges[i].start_handle,
          this.new_edges[i].end_handle,
          event_type()
        );
      }
      this.new_edges = [];
  }

  _registerSignals() {
    this.dom.signals.set(
      "edge_types",
      createSignal(Array
        .from(this.graph.edge_types.values())
        .filter(item => item.id >= 0)
      )
    )
  }

  /**
   * @param {DragEvent} e
   */
  _drop(e) {
    e.preventDefault();
    const rect = this.container.getBoundingClientRect();
    this.drop_x = this._snapToGrid(e.clientX - rect.left);
    this.drop_y = this._snapToGrid(e.clientY - rect.top);

    let drop_data = e.dataTransfer.getData("graph/node");
    this.node_data = JSON.parse(drop_data);

    this.graph.createNode({
      type: this.node_data.type,
      name: this.node_data.data.name,
      edges_incoming: [],
      edges_outgoing: [],
      metadata: ""
    }, this.drop_x, this.drop_y)
  }

  /**
   * @param {MouseEvent} e 
   */
  _mouseUp(e) {
    if (this.is_connecting) {
      const rect = this.container.getBoundingClientRect();
      const screen_x = e.clientX - rect.left;
      const screen_y = e.clientY - rect.top;

      const world_coords = this.graph.screenToWorld({x: screen_x, y: screen_y});
      const mouse_x = world_coords.x;
      const mouse_y = world_coords.y;

      const nodes = this.graph.getNodes();

      for (let handle of this.selected_node_handles) {
        for (let node of nodes) {
          const end_handle = node.handle;
          if (end_handle == handle) continue;

          const dx = Math.abs(mouse_x - node.x);
          const dy = Math.abs(mouse_y - node.y);

          if (dx <= this.config.node_radius && dy <= this.config.node_radius) {
            this.new_edges.push({
              start_handle: handle,
              end_handle 
            })
            this.edge_dialog.showModal();
            break;
          }
        }
      }
    }

    this.is_dragging = false;
    this.is_connecting = false;
    this.is_panning = false;
    this.container.style.cursor = "default";
    this.moving_nodes.clear();
    this.moving_edges.clear();

    if (this.is_selecting) {
      const min_x = Math.min(this.selection_start_x, this.current_mouse_x);
      const max_x = Math.max(this.selection_start_x, this.current_mouse_x);
      const min_y = Math.min(this.selection_start_y, this.current_mouse_y);
      const max_y = Math.max(this.selection_start_y, this.current_mouse_y);

      for (let node of this.graph.getNodes()) {
        const inside_x = (node.x >= min_x && node.x <= max_x);
        const inside_y = (node.y >= min_y && node.y <= max_y);
        if (inside_x && inside_y) {
          this.selected_node_handles.push(node.handle);
        }
      }

      this.is_selecting = false;
    }
    this.graph.emit("world:update");
  }

  /**
   * @param {KeyboardEvent} e
   */
  _keydown(e) {
    if (
      (e.key == "Delete") &&
        this.selected_node_handles.length > 0
    ) {
      for (let handle of this.selected_node_handles) {
        this.graph.deleteNode(handle);
      }
      this.selected_node_handles = [];
    }

    if (e.key == "Backspace" && this.selected_node_handles.length > 0) {
      for (let handle of this.selected_node_handles) {
        this.graph.deleteOutgoing(handle)
      }
    }
  }

  /**
   * @param {WheelEvent} e 
   */
  _wheel(e) {
    e.preventDefault();

    const zoom_intensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoom_intensity);

    const rect = this.container.getBoundingClientRect();
    const mouse_x = e.clientX - rect.left;
    const mouse_y = e.clientY - rect.top;

    const world_before = this.graph.screenToWorld({x: mouse_x, y: mouse_y}, false);

    this.graph.zoom(zoom)

    const world_after = this.graph.screenToWorld({x: mouse_x, y: mouse_y}, false);

    this.graph.pan(
      (world_after.x - world_before.x) * this.graph.scale,
      (world_after.y - world_before.y) * this.graph.scale
    )
  }

  /**
   * @param {MouseEvent} e 
   */
  _mouseDown(e) {
    const rect = this.container.getBoundingClientRect();

    const screen_x = e.clientX - rect.left;
    const screen_y = e.clientY - rect.top;

    const world_coords = this.graph.screenToWorld({x: screen_x, y: screen_y}, false);
    const mouse_x = world_coords.x;
    const mouse_y = world_coords.y;

    if (e.ctrlKey) {
      this.is_panning = true;
      this.pan_start_x = screen_x;
      this.pan_start_y = screen_y;
      this.container.style.cursor = "move";
      return;
    }

    const nodes = this.graph.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = Math.abs(mouse_x - node.x);
      const dy = Math.abs(mouse_y - node.y);

      if (dx <= this.config.node_radius && dy <= this.config.node_radius) {
        if (!this.selected_node_handles.includes(node.handle)) {
          this.selected_node_handles = [node.handle]
        }
        if (e.shiftKey) {
          this.is_connecting = true;
        } else {
          this.is_dragging = true;
          this.drag_offsets.clear();
          for (let handle of this.selected_node_handles) {
            const node = this.graph.getNode(handle);
            const dx = mouse_x - node.x;
            const dy = mouse_y - node.y;
            this.drag_offsets.set(handle, {dx, dy})
          }
          this.container.style.cursor = "grabbing";
        }
        return;
      }
    }

    if (this.is_dragging) {
      this.moving_nodes.clear();
      this.moving_edges.clear();

      for (const handle of this.selected_node_handles) {
        this.moving_nodes.add(handle);
        const node = this.graph.getNode(handle);
        if (node) {
          node.edges_incoming.forEach(edgeHandle => this.moving_edges.add(edgeHandle));
          node.edges_outgoing.forEach(edgeHandle => this.moving_edges.add(edgeHandle));
        }
      }
      this._drawObjects();
    }

    this.selected_node_handles = [];
    this.is_selecting = true;
    this.selection_start_x = mouse_x;
    this.selection_start_y = mouse_y;
  }
  /**
   * @param {MouseEvent} e 
   */
  _mouseMove(e) {
    const rect = this.container.getBoundingClientRect();

    const screen_x = e.clientX - rect.left;
    const screen_y = e.clientY - rect.top;

    const world_coords = this.graph.screenToWorld({x: screen_x, y: screen_y}, false)
    const mouse_x = world_coords.x;
    const mouse_y = world_coords.y;

    this.current_mouse_x = mouse_x;
    this.current_mouse_y = mouse_y;

    if (this.is_dragging) {
      for (let [handle, offset] of this.drag_offsets.entries()) {
        const new_x = this._snapToGrid(mouse_x - offset.dx);
        const new_y = this._snapToGrid(mouse_y - offset.dy);
        this.graph.setNodePosition(handle, new_x, new_y);
      }
    }

    if (this.is_panning) {
      const screen_x = e.clientX - rect.left;
      const screen_y = e.clientY - rect.top;

      const dx = screen_x - this.pan_start_x;
      const dy = screen_y - this.pan_start_y;

      this.graph.pan(dx, dy);

      this.pan_start_x = screen_x;
      this.pan_start_y = screen_y;
      return;
    }
  }

  _drawInteractions() {
    const layer = this.layers.get("interactions")
    const logicalWidth = layer.canvas.width / this.dpr;
    const logicalHeight = layer.canvas.height / this.dpr;
    layer.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    layer.ctx.save();
    layer.ctx.translate(this.graph.pan_coords.x, this.graph.pan_coords.y);
    layer.ctx.scale(this.graph.scale, this.graph.scale);

    if (this.is_connecting) {
      for (let handle of this.selected_node_handles) {
        const start_node = this.graph.getNode(handle)
        const mouse_coords = {
          x: this._snapToGrid(this.current_mouse_x),
          y: this._snapToGrid(this.current_mouse_y)
        };
        const { startGate, endGate } = getBestGates(
          {
            x: start_node.x,
            y: start_node.y
          }, mouse_coords);
        const startCoords = getGateCoordinates(start_node, startGate, this.config.node_radius);

        drawEdgeOrthogonal(
          layer.ctx,
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

    if (this.is_selecting) {
      layer.ctx.beginPath(); //#089fff
      layer.ctx.strokeStyle = this.selection_color;
      layer.ctx.fillStyle = `rgba(8, 190, 255, 0.1)`
      layer.ctx.moveTo(this.selection_start_x, this.selection_start_y);
      layer.ctx.lineTo(this.selection_start_x, this.current_mouse_y);
      layer.ctx.lineTo(this.current_mouse_x, this.current_mouse_y);
      layer.ctx.lineTo(this.current_mouse_x, this.selection_start_y);
      layer.ctx.lineTo(this.selection_start_x, this.selection_start_y);
      layer.ctx.stroke();
      layer.ctx.fill();
    }

    const edge_bundles = this.graph.getEdgeBundles((edge) => {
      return this.moving_edges.has(edge.handle)
    });

    edge_bundles.forEach(bundle => {
      this._drawEdgeBundle(bundle, layer);
    });

    const nodes = this.graph.getNodes()
    .filter(node => this.moving_nodes.has(node.handle));

    for (const node of nodes) {
      this._drawNode(node, layer);
    }

    layer.ctx.restore();
    requestAnimationFrame(this._drawInteractions.bind(this));
  }

  _drawStatic() {
    const layer = this.layers.get("static")
    const logicalWidth = layer.canvas.width / this.dpr;
    const logicalHeight = layer.canvas.height / this.dpr;
    layer.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    layer.ctx.save();
    layer.ctx.translate(this.graph.pan_coords.x, this.graph.pan_coords.y);
    layer.ctx.scale(this.graph.scale, this.graph.scale);

    drawWorldGrid(
      layer.ctx,
      logicalWidth,
      logicalHeight,
      this.config.grid_size,
      this.graph
    );
    layer.ctx.restore();
  }

  _drawObjects() {
    const layer = this.layers.get("objects")
    const logicalWidth = layer.canvas.width / this.dpr;
    const logicalHeight = layer.canvas.height / this.dpr;
    layer.ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    layer.ctx.save();
    layer.ctx.translate(this.graph.pan_coords.x, this.graph.pan_coords.y);
    layer.ctx.scale(this.graph.scale, this.graph.scale);

    const edge_bundles = this.graph.getEdgeBundles((edge) => {
      return !this.moving_edges.has(edge.handle)
    });

    edge_bundles.forEach(bundle => {
      this._drawEdgeBundle(bundle, layer);
    });

    const nodes = this.graph.getNodes()
    .filter(node => !this.moving_nodes.has(node.handle));

    for (let node of nodes) {
      this._drawNode(node, layer);
    }
    layer.ctx.restore();
  }

  /**
   * @param {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}} layer 
   * @param {Array<import("./graph-editor-api.js").Edge>} bundle 
   */
  _drawEdgeBundle(bundle, layer) {
    layer.ctx.strokeStyle = "#333333";
    layer.ctx.lineWidth = 2;

    const bundleSize = bundle.length;
    const initialOffset = -(bundleSize - 1) / 2.0;

    bundle.forEach((edge, index) => {
      const start_node = this.graph.getNode(edge.start_handle);
      const end_node = this.graph.getNode(edge.end_handle);

      const edge_type = this.graph.getEdgeType(edge.type);

      const { startGate, endGate } = getBestGates({
        y: start_node.y,
        x: start_node.x,
      }, {
          y: end_node.y,
          x: end_node.x
        });

      const startCoords = getGateCoordinates(start_node, startGate, this.config.node_radius);
      const endCoords = getGateCoordinates(end_node, endGate, this.config.node_radius);

      const offset = initialOffset + index;

      drawEdgeOrthogonal(
        layer.ctx,
        startCoords,
        startGate,
        endCoords,
        endGate,
        offset,
        edge_type,
        this.selected_node_handles.includes(edge.start_handle)
      );
    });
  }

  /**
   * @param {import("./graph-editor-api.js").Node} node 
   * @param {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}} layer 
   */
  _drawNode(node, layer) {
    const { x, y } = node;
    layer.ctx.beginPath();
    const type = this.graph.getNodeType(node.type);
    switch (type.shape) {
      case NodeShape.CIRCLE:
        layer.ctx.arc(x, y, this.config.node_radius, 0, 2 * Math.PI);
        break;
      case NodeShape.DIAMOND:
        layer.ctx.moveTo(x, y - this.config.node_radius);
        layer.ctx.lineTo(x + this.config.node_radius, y);
        layer.ctx.lineTo(x, y + this.config.node_radius);
        layer.ctx.lineTo(x - this.config.node_radius, y);
        layer.ctx.lineTo(x, y - this.config.node_radius);
        break;
      case NodeShape.SQUARE:
        layer.ctx.rect(x - this.config.node_radius, y - this.config.node_radius, this.config.node_radius * 2, this.config.node_radius * 2);
        break;
      case NodeShape.SQUARE_ROUNDED:
        layer.ctx.roundRect(x - this.config.node_radius, y - this.config.node_radius, this.config.node_radius * 2, this.config.node_radius * 2, [5]);
        break;
    }
    layer.ctx.fillStyle = type.fill_color;
    layer.ctx.fill();
    if (this.selected_node_handles.includes(node.handle)) {
      layer.ctx.strokeStyle = this.selection_color;
      layer.ctx.lineWidth = 4;
    } else {
      layer.ctx.lineWidth = type.stroke_width;
      layer.ctx.strokeStyle = type.stroke_color;
    }
    layer.ctx.stroke();

    layer.ctx.beginPath();
    layer.ctx.fillStyle = "#fff";
    layer.ctx.rect(x - (node.name.length / 2) * 8, y + this.config.node_radius + 5, node.name.length * 8, 20);
    layer.ctx.fill();

    layer.ctx.fillStyle = "#000";
    layer.ctx.font = "12px monospace";
    layer.ctx.textAlign = "center";
    layer.ctx.textBaseline = "top";
    layer.ctx.fillText(node.name, x, y + this.config.node_radius + 10);
  }
}

/**
 * Creates a draggable node element
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

/**
 * @param {CanvasRenderingContext2D} ctx The canvas context.
 * @param {number} canvasWidth The width of the canvas element.
 * @param {number} canvas_height The height of the canvas element.
 * @param {GraphEditor} graph 
 * @param {number} grid_size 
 */
function drawWorldGrid(ctx, canvasWidth, canvas_height, grid_size, graph) {
  if (graph.scale < 0.5) return;
  const worldViewTopLeft = graph.screenToWorld({x: 0, y: 0});
  const worldViewBottomRight = graph.screenToWorld({x: canvasWidth, y: canvas_height});

  const startX = Math.floor(worldViewTopLeft.x / grid_size) * grid_size;
  const startY = Math.floor(worldViewTopLeft.y / grid_size) * grid_size;

  const dotRadius = 1;

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
 * @param {import("./typedefs.js").Coords} startNode The start node's coordinates.
 * @param {import("./typedefs.js").Coords} endNode The end node's coordinates.
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
 * @param {import("./typedefs.js").Coords} node The node's center coordinates.
 * @param {number} gate The gate (from GATES enum).
 * @param {number} radius The node's radius.
 * @returns {import("./typedefs.js").Coords}
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
 * @param {import("./typedefs.js").Coords} startCoords - 
 * @param {number} startGate - 
 * @param {import("./typedefs.js").Coords} endCoords - 
 * @param {number} endGate - 
 * @param {number} offset - 
 * @param {import("./graph-editor-api.js").EdgeType} edge_type 
 * @param {boolean} render_name 
 */
function drawEdgeOrthogonal(ctx, startCoords, startGate, endCoords, endGate, offset, edge_type, render_name = false) {
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

  if (render_name) {
    const midX = sx + (ex - sx) / 2 + offsetAmount;
    const midY = sy + (ey - sy) / 2 + offsetAmount;
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.rect(midX - (edge_type.name.length / 2) * 8, midY - 10, edge_type.name.length * 8, 20);
    ctx.fill();

    ctx.fillStyle = "#6e6e6e";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(edge_type.name, midX, midY - 5);
  }

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
