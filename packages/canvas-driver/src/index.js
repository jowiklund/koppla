import { assert_is_not_null, assert_msg } from "@kpla/assert";
import { getEngine, GraphEditor, IGraphStore, NodeShape } from "@kpla/engine";
import { EventEmitter } from "./event-emitter.js";
import { EventName, State, StateMachine } from "./state-machine.js";
import { createSignal } from "@kpla/signals";

/** 
 * @typedef {Object} NodeData
 * @property {{name: string, color: string}} data
 * @property {number} type
 */

/**
 * @typedef {Object} CanvasDriverOptions
 * @property {string} container_id
 * @property {string} control_panel_id
 * @property {string} wasm_url
 * @property {number} [node_radius]
 * @property {number} [grid_size]
 */

/**
 * @typedef {Object} PositionData
 * @property {import("@kpla/engine").Coords} screen
 * @property {import("@kpla/engine").Coords} mouse
 * @property {import("@kpla/engine").Node | null} node
 */

/** @typedef {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}} Layer */

const styles = getComputedStyle(document.body)

/**
 * @enum {string}
 * @readonly
 */
const Colors = {
  background_primary: styles.getPropertyValue("--background-primary"),
  background_secondary: styles.getPropertyValue("--background-secondary"),
  text_primary: styles.getPropertyValue("--text-primary"),
  text_secondary: styles.getPropertyValue("--text-primary"),
  accent_color: styles.getPropertyValue("--accent-color"),
  accent_color_secondary: styles.getPropertyValue("--accent-color-secondary"),
  accent_color_tertiary: styles.getPropertyValue("--accent-color-tertiary"),
  accent_color_op: styles.getPropertyValue("--accent-color-op"),
}

/** @enum {string} */
const Alignment = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical"
}

/**
 * @enum {number}
 * @readonly
 */
export const Tool = {
  CURSOR: 0,
  CONNECTOR: 1,
  ADD_NODE: 2,
  PAN: 3
}

/**
 * @enum {number}
 * @readonly
 */
export const LayerName = {
  STATIC: 0,
  OBJECTS: 1,
  INTERACTIONS: 2
}

/**
 * @enum {string}
 * @readonly
 */
export const Evt = {
  WORLD_UPDATE: "world:update",
  DBL_CLICK: "dblclick",
  NODE_CREATE: "node:create",
  CREATE_EDGES: "create:edges",
  RUN: "run",
  CLICK: "click"
}

export class CanvasGUIDriver extends EventEmitter {
  /** @type {HTMLElement} */
  container;
  /** @type {HTMLElement} */
  control_panel;
  /** @type {GraphEditor | null} */
  graph = null;
  dpr = 1;
  drop_x = 0;
  drop_y = 0;
  /** @type {NodeData | null} */
  drop_data = null;

  /** @type {Map<LayerName, Layer>} */
  layers = new Map();

  config = {
    grid_size: 20,
    node_radius: 20,
    wasm_url: ""
  };

  /** @type {Set<import("@kpla/engine").NodeHandle>} */
  moving_nodes = new Set();
  /** @type {Set<import("@kpla/engine").EdgeHandle>} */
  moving_edges = new Set();

  drag_offsets = new Map();

  selection_start_x = 0;
  selection_start_y = 0;

  pan_start_x = 0;
  pan_start_y = 0;

  /** @type {import("@kpla/engine").EdgeBase[]} */
  new_edges = [];

  /** @type {import("@kpla/signals").Signal<Array<import("@kpla/engine").Node>>} */
  selected_nodes = createSignal(/** @type {import("@kpla/engine").Node[]} */([]));

  /** @type {StateMachine} state */
  state;

  /** @type {Tool} */
  current_tool = Tool.CURSOR;
  /** @type {string} */
  current_edge_type = ""
  /** @type {string} */
  current_node_type = ""

  /** @type {import("@kpla/signals").Signal<PositionData | null>} */
  current_position = createSignal(/** @type {PositionData | null} */(null));

  /**
   * @param {CanvasDriverOptions} opts
   */
  constructor(opts) {
    super();
    this.state = new StateMachine();
    assert_is_not_null(opts.control_panel_id);
    assert_is_not_null(opts.container_id);

    const canvas_container = document.getElementById(opts.container_id);
    assert_is_not_null(canvas_container);
    this.container = canvas_container;

    const canvas_styles = document.createAttribute("style");
    canvas_styles.value = "display: block; position: absolute; inset: 0;"

    Object.assign(this.config, opts);

    this.dpr = window.devicePixelRatio || 1;

    this._createLayer(LayerName.STATIC);
    this._createLayer(LayerName.OBJECTS);
    this._createLayer(LayerName.INTERACTIONS);

    const control_panel = document.getElementById(opts.control_panel_id);
    assert_is_not_null(control_panel);
    this.control_panel = control_panel;
  }

  /**
   * @private
   * @param {LayerName} name 
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
    assert_is_not_null(ctx);
    ctx.scale(this.dpr, this.dpr);

    this.layers.set(name, {
      canvas,
      ctx,
    });
  }

  /**
   * @private
   * @param {number} value 
   */
  _snapToGrid(value) {
    return Math.round(value / this.config.grid_size) * this.config.grid_size;
  }

  /** @param {Alignment} alignment  */
  alignNodes(alignment) {
    assert_is_not_null(this.graph);
    const [selected_nodes] = this.selected_nodes;
    const handles = selected_nodes().map(node => node.handle);
    if (handles.length == 0) return;
    switch(alignment) {
      case Alignment.HORIZONTAL:
        this.graph.alignHoriz(handles);
        break;
      case Alignment.VERTICAL:
        this.graph.alignVert(handles);
        break;
    }
  }

  /** @param {Alignment} alignment  */
  distributeNodes(alignment) {
    assert_is_not_null(this.graph);
    const [selected_nodes] = this.selected_nodes;
    const handles = selected_nodes().map(node => node.handle);
    if (handles.length == 0) return;
    switch(alignment) {
      case Alignment.HORIZONTAL:
        this.graph.evenHoriz(handles);
        break;
      case Alignment.VERTICAL:
        this.graph.evenVert(handles);
        break;
    }
  }

  /**
 * @param {IGraphStore} store 
 * @returns {Promise<GraphEditor>}
 */
  async run(store) {
    this.graph = await getEngine(this.config.wasm_url, this.config.grid_size, store);
    assert_is_not_null(this.graph);
    await this.graph.store_loaded;

    this.graph.on("world:update", this._updateSelection.bind(this))

    this.graph.coordinate_rounder = this._snapToGrid.bind(this);

    const edge_types = this.graph.getEdgeTypes();
    assert_msg(edge_types.length > 0, "No registered edge types");
    this.current_edge_type = edge_types[0].id;

    const node_types = this.graph.getNodeTypes();
    assert_msg(node_types.length > 0, "No registered node types");
    this.current_node_type = node_types[0].id;

    this._registerControls();

    this._drawInteractions()

    this._drawObjects();
    this.graph.on("world:update", this._drawObjects.bind(this));

    this._drawStatic();
    this.graph.on("world:pan", this._drawStatic.bind(this));
    this.graph.on("world:zoom", this._drawStatic.bind(this));

    this.emit(Evt.RUN, this.graph);

    return this.graph;
  }

  /** @private */
  _registerControls() {
    assert_is_not_null(this.graph);
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === this.container) {
          this._onResize();
        }
      }
    }); 

    this.resizeObserver.observe(this.container);

    window.addEventListener("keydown", this._keydown.bind(this));
    window.addEventListener("resize", this._onResize.bind(this));
    this.container.addEventListener("mousedown", this._mouseDown.bind(this));
    this.container.addEventListener("mousemove", this._mouseMove.bind(this));
    this.container.addEventListener("wheel", this._wheel.bind(this));
    this.container.addEventListener("mouseup", this._mouseUp.bind(this));
    this.container.addEventListener("dblclick", this._doubleClick.bind(this));

    this.container.addEventListener("dragover", (e) => {
      e.preventDefault();
      assert_is_not_null(e.dataTransfer);
      e.dataTransfer.dropEffect = "move";
    })
  }

  /** 
   * Updates the selected nodes with new values from the graph engine
   * @private 
   */
  _updateSelection() {
    assert_is_not_null(this.graph);
    const [selected, setSelected] = this.selected_nodes;
    if (selected().length == 0) return;
    const updated_nodes = selected()
      .map(n => this.graph?.getNode(n.handle))
      .filter(n => n != null)
    setSelected(updated_nodes)
  }

  /**
   * @param {MouseEvent} e
   */
  _doubleClick(e) {
    assert_is_not_null(this.graph);
    const pos = this._getPositionData({x: e.clientX, y: e.clientY});
    this.emit(Evt.DBL_CLICK, pos);
    if (pos.node !== null) {
      const children = [pos.node.handle];
      while (children.length > 0) {
        const current_handle = children.shift();
        if (!current_handle) {
          console.warn("No handle")
          continue;
        }
        const current_node = this.graph.getNode(current_handle);
        console.log(current_handle, current_node)
        if (!current_node) {
          console.warn("No node")
          continue;
        }
        if (current_node.edges_outgoing.length > 0) {
          for (const edge_handle of current_node.edges_outgoing) {
            const edge = this.graph.getEdge(edge_handle);
            if (!edge) continue;
            const node = this.graph.getNode(edge.end_handle)
            if (!node) continue;
            children.push(node.handle)
          }
        }
        this._selectNode(current_node);
      }
      this._drawObjects();
    }
  }

  /**
   * @param {import("@kpla/engine").Node} node 
   */
  _selectNode(node) {
    console.log(node)
    const [selected, setSelected] = this.selected_nodes;
    setSelected([...selected(), node])
  }

  /**
   * @private
   * @param {MouseEvent} e 
   */
  _mouseUp(e) {
    assert_is_not_null(this.graph);

    if (this.state.is(State.CONNECTING)) {
      const rect = this.container.getBoundingClientRect();
      const screen_x = e.clientX - rect.left;
      const screen_y = e.clientY - rect.top;

      const world_coords = this.graph.screenToWorld({x: screen_x, y: screen_y});
      const mouse_x = world_coords.x;
      const mouse_y = world_coords.y;

      const nodes = this.graph.getNodes();

      /** @type {import("@kpla/engine").EdgeBase[]} */
      const new_edges = []
      const [selected] = this.selected_nodes;
      for (let { id } of selected()) {
        if (id === undefined) continue;
        for (let node of nodes) {
          const end_id = node.id;
          if (end_id === undefined) continue;
          if (end_id == id) continue;

          const dx = Math.abs(mouse_x - node.x);
          const dy = Math.abs(mouse_y - node.y);

          if (dx <= this.config.node_radius && dy <= this.config.node_radius) {
            /** @type {import("@kpla/engine").Edge} */
            new_edges.push({
              type: this.current_edge_type,
              end_id: end_id,
              start_id: id,
            })
            break;
          }
        }
      }

      for (const edge of new_edges) {
        this.graph.createEdge(edge)
      }

      const evt = new CustomEvent("kpla-new-edges", {
        detail: this.new_edges
      });

      this.container.dispatchEvent(evt);
      this.emit(Evt.CREATE_EDGES, this.new_edges);
      this.new_edges = []
    }

    this.container.style.cursor = "default";
    this.moving_nodes.clear();
    this.moving_edges.clear();

    if (this.state.is(State.SELECTING)) {
      const { mouse } = this.state.ctx.pos;
      const min_x = Math.min(this.selection_start_x, mouse.x);
      const max_x = Math.max(this.selection_start_x, mouse.x);
      const min_y = Math.min(this.selection_start_y, mouse.y);
      const max_y = Math.max(this.selection_start_y, mouse.y);

      const [selected, setSelected] = this.selected_nodes;
      const data = selected()
      for (let node of this.graph.getNodes()) {
        const inside_x = (node.x >= min_x && node.x <= max_x);
        const inside_y = (node.y >= min_y && node.y <= max_y);
        if (inside_x && inside_y) {
          data.push(node);
          setSelected(data);
        }
      }
    }

    this.state.dispatch(EventName.MOUSE_UP, {
      pos: {
        node: null,
        screen: {x: 0, y: 0},
        mouse: {x: 0, y: 0}
      }, 
      event: e,
      tool: this.current_tool
    })
    this.graph.emit(Evt.WORLD_UPDATE);
  }

  /**
   * @private
   * @param {KeyboardEvent} e
   */
  _keydown(e) {
    assert_is_not_null(this.graph);
    if (
      (e.key == "Delete") &&
        this.selected_nodes.length > 0
    ) {
      const [selected, setSelected] = this.selected_nodes;
      for (let { handle } of selected()) {
        this.graph.deleteNode(handle);
      }
      setSelected([]);
    }

    if (e.key == "Backspace" && this.selected_nodes.length > 0) {
      const [selected] = this.selected_nodes;
      for (let { handle } of selected()) {
        this.graph.deleteOutgoing(handle)
      }
    }
  }

  /**
   * @private
   * @param {WheelEvent} e 
   */
  _wheel(e) {
    assert_is_not_null(this.graph);
    e.preventDefault();

    const zoom_intensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoom_intensity);

    const rect = this.container.getBoundingClientRect();
    const mouse_x = e.clientX - rect.left;
    const mouse_y = e.clientY - rect.top;

    const world_before = this.graph.screenToWorld({x: mouse_x, y: mouse_y});

    this.graph.zoom(zoom)

    const world_after = this.graph.screenToWorld({x: mouse_x, y: mouse_y});

    this.graph.pan(
      (world_after.x - world_before.x) * this.graph.scale,
      (world_after.y - world_before.y) * this.graph.scale
    )
  }

  _onResize() {
    const rect = this.container.getBoundingClientRect();
    for (const [_, layer] of this.layers.entries()) {
      layer.canvas.width = rect.width * this.dpr;
      layer.canvas.height = rect.height * this.dpr;
      layer.ctx.scale(this.dpr, this.dpr);
    }
    this._drawStatic();
    this._drawObjects();
  }

  /**
   * @private
   * @param {MouseEvent} e 
   */
  _mouseDown(e) {
    assert_is_not_null(this.graph);

    this.state.dispatch(EventName.MOUSE_DOWN, {
      pos: this._getPositionData({
        x: e.clientX,
        y: e.clientY
      }),
      event: e,
      tool: this.current_tool
    })

    this.emit(Evt.CLICK, this.state.ctx.pos);

    if (this.state.is(State.CREATE_NODE)) {
      this.emit(Evt.NODE_CREATE, {
        type: this.current_node_type,
        name: "",
        metadata: "",
        x: this.state.ctx.pos.screen.x,
        y: this.state.ctx.pos.screen.y,
      })
      this.state.dispatch(EventName.MOUSE_UP, {
        pos: {
          node: null,
          screen: {x: 0, y: 0},
          mouse: {x: 0, y: 0}
        }, 
        event: e,
        tool: this.current_tool
      })
      return;
    }

    if (this.state.is(State.PANNING)) {
      const {screen} = this.state.ctx.pos;
      this.pan_start_x = screen.x;
      this.pan_start_y = screen.y;
      this.container.style.cursor = "move";
      return;
    }

    if (this.state.is(State.CONNECTING)) {
      const {node} = this.state.ctx.pos;
      assert_is_not_null(node);
      const [_, setSelected] = this.selected_nodes;
      if (!this._isSelected(node.handle)) {
        setSelected([node]);
      }
      return;
    }

    if (this.state.is(State.DRAGGING)) {
      const {node, mouse} = this.state.ctx.pos;
      assert_is_not_null(node);
      const [selected, setSelected] = this.selected_nodes;
      if (!this._isSelected(node.handle)) {
        setSelected([node]);
      }
      this.drag_offsets.clear();
      for (let node of selected()) {
        assert_is_not_null(node);
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        this.drag_offsets.set(node.handle, {dx, dy})
      }
      this.container.style.cursor = "grabbing";

      this.moving_nodes.clear();
      this.moving_edges.clear();

      for (const { handle } of selected()) {
        this.moving_nodes.add(handle);
        const node = this.graph.getNode(handle);
        if (node) {
          node.edges_incoming.forEach(edgeHandle => this.moving_edges.add(edgeHandle));
          node.edges_outgoing.forEach(edgeHandle => this.moving_edges.add(edgeHandle));
        }
      }
      this._drawObjects();
      return;
    }

    const {mouse} = this.state.ctx.pos;
    const [_, setSelected] = this.selected_nodes;
    setSelected([]);
    this.selection_start_x = mouse.x;
    this.selection_start_y = mouse.y;
  }

  /**
   * @param {import("@kpla/engine").NodeHandle} node_handle 
   */
  _isSelected(node_handle) {
    const [ selected ] = this.selected_nodes;
    return selected().findIndex(n => n.handle === node_handle) >= 0;
  }

  /**
   * @param {import("@kpla/engine").Coords} mouse_coords 
   * @returns {PositionData}
   */
  _getPositionData(mouse_coords)  {
    assert_is_not_null(this.graph);
    const rect = this.container.getBoundingClientRect();

    const screen_x = mouse_coords.x - rect.left;
    const screen_y = mouse_coords.y - rect.top;

    const {x, y} = this.graph.screenToWorld({x: screen_x, y: screen_y});

    const coords = {
      mouse: {x,y},
      screen: {
        x: screen_x,
        y: screen_y
      }
    }

    const nodes = this.graph.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = Math.abs(x - node.x);
      const dy = Math.abs(y - node.y);

      if (dx <= this.config.node_radius && dy <= this.config.node_radius) {
        return {
          node,
          ...coords
        }
      }
    }
    return {
      node: null,
      ...coords
    }
  }

  /**
   * @private
   * @param {MouseEvent} e 
   */
  _mouseMove(e) {
    assert_is_not_null(this.graph);
    const rect = this.container.getBoundingClientRect();

    this.state.ctx.pos = this._getPositionData({x: e.clientX, y: e.clientY});
    this.state.ctx.event = e;
    const [_, setPos] = this.current_position;

    setPos(this.state.ctx.pos);

    if (this.state.is(State.DRAGGING)) {
      const {mouse} = this.state.ctx.pos;
      for (let [handle, offset] of this.drag_offsets.entries()) {
        const new_x = this._snapToGrid(mouse.x - offset.dx);
        const new_y = this._snapToGrid(mouse.y - offset.dy);
        this.graph.setNodePosition(handle, new_x, new_y);
      }
    }

    if (this.state.is(State.PANNING)) {
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

  /** @private */
  _drawInteractions() {
    assert_is_not_null(this.graph);
    const layer = this.layers.get(LayerName.INTERACTIONS)
    assert_is_not_null(layer)
    const logicalWidth = layer.canvas.width / this.dpr;
    const logicalHeight = layer.canvas.height / this.dpr;
    layer.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    layer.ctx.save();
    layer.ctx.translate(this.graph.pan_coords.x, this.graph.pan_coords.y);
    layer.ctx.scale(this.graph.scale, this.graph.scale);

    if (this.state.is(State.CONNECTING)) {
      const {mouse} = this.state.ctx.pos;
      const [selected] = this.selected_nodes;
      for (let { handle } of selected()) {
        const start_node = this.graph.getNode(handle)
        assert_is_not_null(start_node);
        const mouse_coords = {
          x: this._snapToGrid(mouse.x),
          y: this._snapToGrid(mouse.y),
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
            stroke_color: Colors.text_primary,
            name: "",
            id: "0"
          },
          this.config.grid_size
        );
      }
    }

    if (this.state.is(State.SELECTING)) {
      const {mouse} = this.state.ctx.pos;
      layer.ctx.beginPath(); //#089fff
      layer.ctx.strokeStyle = Colors.accent_color_secondary;
      layer.ctx.fillStyle = Colors.accent_color_secondary + "10";
      layer.ctx.moveTo(this.selection_start_x, this.selection_start_y);
      layer.ctx.lineTo(this.selection_start_x, mouse.y);
      layer.ctx.lineTo(mouse.x, mouse.y);
      layer.ctx.lineTo(mouse.x, this.selection_start_y);
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

  /** @private */
  _drawStatic() {
    assert_is_not_null(this.graph);
    const layer = this.layers.get(LayerName.STATIC);
    assert_is_not_null(layer);
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

  /** @private */
  _drawObjects() {
    assert_is_not_null(this.graph);
    const layer = this.layers.get(LayerName.OBJECTS)
    assert_is_not_null(layer);
    const logical_width = layer.canvas.width / this.dpr;
    const logical_height = layer.canvas.height / this.dpr;
    layer.ctx.clearRect(0, 0, logical_width, logical_height);
    layer.ctx.save();
    layer.ctx.translate(this.graph.pan_coords.x, this.graph.pan_coords.y);
    layer.ctx.scale(this.graph.scale, this.graph.scale);

    const world_corners = this._getWorldCorners(
      logical_width,
      logical_height,
      50 / this.graph.scale
    );

    const visible_nodes = this.graph.getNodes()
    .filter(node => !this.moving_nodes.has(node.handle))
    .filter(n => this._isInView({x: n.x, y: n.y}, world_corners));

    const visible_handles = new Set(visible_nodes.map(n => n.handle));


    const edge_bundles = this.graph.getEdgeBundles((edge) => {
      return !this.moving_edges.has(edge.handle) &&
        (
          visible_handles.has(edge.start_handle) ||
            visible_handles.has(edge.end_handle)
        )
    });

    for (const bundle of edge_bundles.values()) {
      this._drawEdgeBundle(bundle, layer)
    }

    for (let node of visible_nodes) {
      this._drawNode(node, layer);
    }

    layer.ctx.restore();
  }

  /**
   * @param {Layer} layer 
   * @returns {Promise<Blob>}
   */
  getLayerSnapshot(layer) {
    assert_is_not_null(this.graph);
    const bounds = this.graph.getWorldBounds();
    return new Promise((resolve, reject) => {
      const quality = 0.9;
      const width = bounds.bottom_right.x - bounds.top_left.x + 
        (this.config.node_radius * 2);
      const height = bounds.bottom_right.y - bounds.top_left.y + 
        (this.config.node_radius * 2);

      const img_data = document.createElement("canvas");
      img_data.width = width;
      img_data.height = height;
      const img_data_ctx = img_data.getContext("2d");
      assert_is_not_null(img_data_ctx);
      img_data_ctx.drawImage(
        layer.canvas,
        bounds.top_left.x,
        bounds.top_left.y,
        width,
        height,
        0,
        0,
        width,
        height
      )
      const img_data_url = img_data.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create snapshot"));
        }
      }, 'image/png', quality)

      return img_data_url
    })
  }

  /**
   * @param {import("@kpla/engine").Coords} coords 
   * @param {[import("@kpla/engine").Coords, import("@kpla/engine").Coords]} world_corners
   */
  _isInView(coords, world_corners) {
    const [top_left, bottom_right] = world_corners;
    return coords.x > top_left.x &&
      coords.x < bottom_right.x &&
      coords.y > top_left.y &&
      coords.y < bottom_right.y
  }

  /**
   * @param {number} canvas_width 
   * @param {number} canvas_height
   * @param {number} buffer
   * @returns {[import("@kpla/engine").Coords, import("@kpla/engine").Coords]}
   */
  _getWorldCorners(canvas_width, canvas_height, buffer = 0) {
    assert_is_not_null(this.graph);
    const world_top_left = this.graph.screenToWorld({x: 0 - buffer, y: 0 - buffer});
    const world_bottom_right = this.graph.screenToWorld({x: canvas_width + buffer, y: canvas_height + buffer});
    return [world_top_left, world_bottom_right];
  }

  /**
   * @private
   * @param {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}} layer 
   * @param {Array<import("@kpla/engine").EdgeWasmData>} bundle 
   */
  _drawEdgeBundle(bundle, layer) {
    layer.ctx.strokeStyle = Colors.text_primary;
    layer.ctx.lineWidth = 2;

    const bundleSize = bundle.length;
    const initialOffset = -(bundleSize - 1) / 2.0;

    for (const [index, edge] of bundle.entries()) {
      assert_is_not_null(this.graph);
      const start_node = this.graph.getNode(edge.start_handle);
      const end_node = this.graph.getNode(edge.end_handle);
      if (!start_node || !end_node) continue;

      const edge_type = this.graph.getEdgeType(edge.type);
      assert_is_not_null(edge_type);

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
        this.config.grid_size,
        this._isSelected(edge.start_handle),
      );
    }
  }

  /**
   * @private
   * @param {import("@kpla/engine").Node} node 
   * @param {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}} layer 
   */
  _drawNode(node, layer) {
    assert_is_not_null(this.graph);
    const { x, y } = node;
    layer.ctx.beginPath();
    const type = this.graph.getNodeType(node.type);
    assert_is_not_null(type, "Invalid node type");
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
    if (this._isSelected(node.handle)) {
      layer.ctx.strokeStyle = Colors.accent_color_secondary;
      layer.ctx.lineWidth = 2;
    } else {
      layer.ctx.lineWidth = type.stroke_width;
      layer.ctx.strokeStyle = type.stroke_color;
    }
    layer.ctx.stroke();

    layer.ctx.beginPath();
    layer.ctx.fillStyle = Colors.background_primary;
    layer.ctx.rect(x - (node.name.length / 2) * 8, y + this.config.node_radius + 5, node.name.length * 8, 20);
    layer.ctx.fill();

    layer.ctx.fillStyle = Colors.text_primary;
    layer.ctx.font = "12px monospace";
    layer.ctx.textAlign = "center";
    layer.ctx.textBaseline = "top";
    layer.ctx.fillText(node.name, x, y + this.config.node_radius + 10);
  }
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
  const world_view_top_left = graph.screenToWorld({x: 0, y: 0});
  const world_view_bottom_right = graph.screenToWorld({x: canvasWidth, y: canvas_height});

  const start_x = Math.floor(world_view_top_left.x / grid_size) * grid_size;
  const start_y = Math.floor(world_view_top_left.y / grid_size) * grid_size;

  const dotRadius = 1;

  ctx.fillStyle = Colors.background_secondary;

  for (let x = start_x; x < world_view_bottom_right.x; x += grid_size) {
    for (let y = start_y; y < world_view_bottom_right.y; y += grid_size) {
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
 * @param {import("@kpla/engine").Coords} startNode The start node's coordinates.
 * @param {import("@kpla/engine").Coords} endNode The end node's coordinates.
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
 * @param {import("@kpla/engine").Coords} node_coords The node's center coordinates.
 * @param {number} gate The gate (from GATES enum).
 * @param {number} radius The node's radius.
 * @returns {import("@kpla/engine").Coords}
 */
function getGateCoordinates(node_coords, gate, radius) {
  switch (gate) {
    case GATES.TOP:    return { x: node_coords.x, y: node_coords.y - radius };
    case GATES.BOTTOM: return { x: node_coords.x, y: node_coords.y + radius };
    case GATES.LEFT:   return { x: node_coords.x - radius, y: node_coords.y };
    case GATES.RIGHT:  return { x: node_coords.x + radius, y: node_coords.y };
    default:           return node_coords;
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import("@kpla/engine").Coords} start_coords
 * @param {number} start_gate
 * @param {import("@kpla/engine").Coords} end_coords
 * @param {number} end_gate
 * @param {number} offset
 * @param {import("@kpla/engine").EdgeType} edge_type
 * @param {number} grid_size 
 * @param {boolean} render_name 
 */
function drawEdgeOrthogonal(
  ctx,
  start_coords,
  start_gate,
  end_coords,
  end_gate,
  offset,
  edge_type,
  grid_size,
  render_name = false,
) {
  const corner_radius = grid_size / 2;
  const bundle_gap = grid_size;
  const offset_amount = offset * bundle_gap;
  const sx = start_coords.x;
  const sy = start_coords.y;
  const ex = end_coords.x;
  const ey = end_coords.y;

  ctx.beginPath();
  ctx.moveTo(sx, sy);

  ctx.strokeStyle = edge_type.stroke_color;
  ctx.lineWidth = edge_type.stroke_width;

  if (edge_type.line_dash) {
    ctx.setLineDash(edge_type.line_dash)
  }

  const is_horizontal_start = start_gate === GATES.LEFT || start_gate === GATES.RIGHT;
  const is_horizontal_end = end_gate === GATES.LEFT || end_gate === GATES.RIGHT;

  if (is_horizontal_start && is_horizontal_end) {
    const mid_x = sx + (ex - sx) / 2 + offset_amount;
    ctx.arcTo(mid_x, sy, mid_x, ey, corner_radius);
    ctx.arcTo(mid_x, ey, ex, ey, corner_radius);
  } else if (!is_horizontal_start && !is_horizontal_end) {
    const mid_y = sy + (ey - sy) / 2 + offset_amount;
    ctx.arcTo(sx, mid_y, ex, mid_y, corner_radius);
    ctx.arcTo(ex, mid_y, ex, ey, corner_radius);
  } else {
    if (is_horizontal_start) {
      const elbow_x = ex;
      const elbow_y = sy;
      ctx.arcTo(elbow_x, elbow_y, ex, ey, corner_radius);
    } else {
      const elbowX = sx;
      const elbowY = ey;
      ctx.arcTo(elbowX, elbowY, ex, ey, corner_radius);
    }
  }

  ctx.lineTo(ex, ey);
  ctx.stroke();

  if (render_name) {
    const midX = sx + (ex - sx) / 2 + offset_amount;
    const midY = sy + (ey - sy) / 2 + offset_amount;
    ctx.beginPath();
    ctx.fillStyle = Colors.background_primary;
    ctx.rect(midX - (edge_type.name.length / 2) * 8, midY - 10, edge_type.name.length * 8, 20);
    ctx.fill();

    ctx.fillStyle = Colors.text_secondary;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(edge_type.name, midX, midY - 5);
  }

  ctx.beginPath();
  ctx.setLineDash([]);
  if (start_gate === GATES.LEFT) {
    ctx.moveTo(sx - 15, sy - 5);
    ctx.lineTo(sx - 20, sy);
    ctx.lineTo(sx - 15, sy + 5);
  }

  if (start_gate === GATES.RIGHT) {
    ctx.moveTo(sx + 15, sy - 5);
    ctx.lineTo(sx + 20, sy);
    ctx.lineTo(sx + 15, sy + 5);
  }

  if (start_gate === GATES.TOP) {
    ctx.moveTo(sx - 5, sy - 15);
    ctx.lineTo(sx, sy - 20);
    ctx.lineTo(sx + 5, sy - 15);
  }

  if (start_gate === GATES.BOTTOM) {
    ctx.moveTo(sx - 5, sy + 35);
    ctx.lineTo(sx, sy + 40);
    ctx.lineTo(sx + 5, sy + 35);
  }

  ctx.fillStyle = Colors.background_primary;
  ctx.fill();
  ctx.stroke();
}
