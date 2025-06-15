/**
 * @module GraphEditorAPI
 * @description Provides a high level JavaScript for interacting with the core graph
 * logic engine written in Zig
 */

/** @typedef {number} NodeHandle */
/** @typedef {number} EdgeHandle */
/** @typedef {string} NodeStyleName */
/** @typedef {number} ZoneType */
/** @typedef {number} GroupType */
/** @typedef {number} CoworkerAuth */
/** @typedef {number} AccessLevel */

/**
 * @typedef {Object} NodeBase
 * @property {string} name - A human readable name displayed underneath the node
 * @property {NodeStyleName} style - The name of a predefined node style
 * @property {Array<NodeHandle>} edges_outgoing
 * @property {Array<NodeHandle>} edges_incoming
 */

/**
 * @typedef {Object} NodeType
 * @property {number} x
 * @property {number} y
 * @property {NodeHandle} handle
 *
 * @typedef {NodeBase & NodeType} Node
 */

/**
 * @typedef {Object} Edge
 * @property {NodeHandle} start_handle
 * @property {NodeHandle} end_handle
 */


/**
 * @readonly 
 * @enum {number}
 */
export const NodeShape = {
  CIRCLE: 0,
  SQUARE: 1,
  SQUARE_ROUNDED: 2,
  DIAMOND: 3
}

/**
 * @typedef {Object} NodeStyle
 * @property {string} fill_color - The fill color
 * @property {string} stroke_color - The stroke color
 * @property {number} stroke_width - The stroke width
 * @property {NodeShape} shape - A predifined node shape
 * @property {string} name - Human readable name
 */

/**
 * @typedef {Map<string, NodeStyle>} Styles
 */

export class GraphEditor {
  /** @type {number} */
  scale = 1.0;
  /** @type {import("./typedefs").Coords} */
  pan_coords = { x: 0, y: 0 }
  /** @type {import("./control-panel.js").CoordinateRounder} */
  coordinate_rounder = null;
  /** @type {Map<NodeHandle, NodeBase>} */
  metadata = new Map();
  /** @type {Styles} */
  styles = new Map();

  /** @private */
  _wasm;

  /**
   * @param {any} wasm_instance 
   */
  constructor(wasm_instance) {
    this._wasm = wasm_instance.exports;
    this._memory = this._wasm.memory;
    this._string_buffer_ptr = this._wasm.js_string_buffer.value;
    this._wasm.init();
  }

  /**
   * @param {Array<NodeBase>} nodes
   */
  loadGraph(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      this.createNode(nodes[i], 100, (150 * i) || 50);
    }
  }

  /**
   * @param {number} x 
   * @param {number} y
   * @param {NodeBase} data 
   * @returns {NodeHandle}
   */
  createNode(data, x, y) {
    const node_handle = this._wasm.createNode(x, y);
    this.metadata.set(node_handle, data);
    return node_handle;
  }

  /**
   * @param {string} name
   * @param {NodeStyle} style
   *
   * @returns void
   */
  setStyle(name, style) {
    this.styles.set(name, style)
  }

  /**
   * @param {string} name 
   *
   * @returns {NodeStyle}
   */
  getStyle(name) {
    return this.styles.get(name);
  }

  /**
   * Pan the world
   *
   * @param {number} dx - Pan diff X
   * @param {number} dy - Pan diff Y
   */
  pan(dx, dy) {
    this.pan_coords.x += dx;
    this.pan_coords.y += dy;
  }

  /**
   * Scale the world
   *
   * @param {number} amount - the amount to zoom
   */
  zoom(amount) {
    this.scale *= amount;
    this.scale = Math.max(0.1, Math.min(this.scale, 6));
  }

  /**
   * Translate coordinates to world coords
   *
   * @param {import("./typedefs").Coords} screen_coords 
   * @param {boolean} round
   */
  screenToWorld(screen_coords, round = true) {
    const world_x = (screen_coords.x - this.pan_coords.x) / this.scale;
    const world_y = (screen_coords.y - this.pan_coords.y) / this.scale;
    if (round) {
      return {
        x: this.coordinate_rounder(world_x),
        y: this.coordinate_rounder(world_y)
      }
    }
    return {
      x: world_x,
      y: world_y
    }
  }

  /**
   * Get the a node by its handle
   * @param {number} handle 
   * @returns {Node | null}
   */
  getNode(handle) {
    const metadata = this.metadata.get(handle);
    if (!metadata) {
      return null;
    }
    /** @type {Node} */
    const node = {
      handle,
      x: this._wasm.getNodeX(handle),
      y: this._wasm.getNodeY(handle),
      name: metadata.name,
      style: metadata.style,
      edges_outgoing: [],
      edges_incoming: []
    }

    const edges_out_len = this._wasm.getNodeOutgoingCount(handle);
    for (let i = 0; i < edges_out_len; i++) {
      const edge_out = this._wasm.getNodeOutgoingHandleByIndex(handle, i);
      node.edges_outgoing.push(edge_out);
    }

    const edges_in_len = this._wasm.getNodeIncomingCount(handle);
    for (let i = 0; i < edges_in_len; i++) {
      const edge_in = this._wasm.getNodeIncomingHandleByIndex(handle, i);
      node.edges_incoming.push(edge_in);
    }

    return node;
  }

  /**
   * Get all nodes
   *
   * @returns {Array<Node>}
   */
  getNodes() {
    const node_count = this._wasm.getNodeCount();

    const nodes = [];

    for (let i = 0; i < node_count; i++) {
      const handle = this._wasm.getNodeHandleByIndex(i);
      const node = this.getNode(handle);
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Update the nodes position with new coordinates
   *
   * @param {number} y 
   * @param {number} x 
   * @param {NodeHandle} handle 
   */
  setNodePosition(handle, x, y) {
    this._wasm.setNodePosition(handle, x, y)
  }

  /**
   * Delete a node
   *
   * @param {NodeHandle} handle 
   */
  deleteNode(handle) {
    this._wasm.deleteNode(handle);
    this.metadata.delete(handle);
  }

  /**
   * @returns {Map<string, Array<Edge>>}
   */
  getEdgeBundles() {
    const nodes = this.getNodes();
    /** @type {Map<string, Array<Edge>>} */
    const bundles = new Map();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      for (let k = 0; k < node.edges_outgoing.length; k++) {
        const out = node.edges_outgoing[k]
        const key = Math.min(node.handle, out) + '-' + Math.max(node.handle, out);
        if (!bundles.has(key)) {
          bundles.set(key, []);
        }
        bundles.get(key).push({start_handle: node.handle, end_handle: out});
      }
    }
    return bundles;
  }

  /**
   * @param {NodeHandle} handle 
   * @returns {ZoneType}
   */
  getZoneNodeZoneType(handle) {
    return this._wasm.getZoneNodeZoneType(handle);
  }

  /**
   * @param {NodeHandle} handle 
   * @returns {CoworkerAuth}
   */
  getCoworkerNodeAuth(handle) {
    return this._wasm.getCoworkerNodeAuth(handle);
  }

  /**
   * @param {NodeHandle} handle 
   * @returns {AccessLevel}
   */
  getAccessNodeAccessLevel(handle) {
    return this._wasm.getAccessNodeAccessLevel(handle);
  }

  /**
   * @param {NodeHandle} start_handle 
   * @param {NodeHandle} end_handle 
   */
  createEdge(start_handle, end_handle) {
    this._wasm.createEdge(start_handle, end_handle);
  }
}

/**
 * @param {string | number | object} data 
 */
function print(data) {
  console.log(data)
}

/**
 * @returns {Promise<GraphEditor | null>}
 */
export async function getEngine() {
  try {
    const wasm_source = await fetch("main.wasm");
    const wasm_buffer = await wasm_source.arrayBuffer();
    const wasm = await WebAssembly.instantiate(wasm_buffer, {
      env: {
        print
      }
    })

    return new GraphEditor(wasm.instance);
  } catch (err) {
    return null
  }
}
