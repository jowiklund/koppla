/**
 * @module GraphEditorAPI
 * @description Provides a high level JavaScript for interacting with the core graph
 * logic engine written in Zig
 */

import { EventEmitter } from "./event-emitter.js";

/** @typedef {number} NodeHandle */
/** @typedef {number} EdgeHandle */
/** @typedef {number} EdgeTypeId */
/** @typedef {number} NodeTypeId */
/** @typedef {string} NodeTypeName */
/** @typedef {number} ZoneType */
/** @typedef {number} GroupType */
/** @typedef {number} CoworkerAuth */
/** @typedef {number} AccessLevel */

/**
 * @typedef {Object} NodeBase
 * @property {string} name - A human readable name displayed underneath the node
 * @property {NodeTypeId} type - The name of a predefined node style
 * @property {Array<NodeHandle>} edges_outgoing
 * @property {Array<NodeHandle>} edges_incoming
 */

/**
 * @typedef {Object} NodeTypeData
 * @property {number} x
 * @property {number} y
 * @property {NodeHandle} handle
 *
 * @typedef {NodeBase & NodeTypeData} Node
 */

/**
 * @typedef {Object} Edge
 * @property {NodeHandle} start_handle
 * @property {NodeHandle} end_handle
 * @property {number} type
 */

/**
 * @typedef {Object} EdgeType
 * @property {string} name - Human readable name
 * @property {string} metadata - Any serialized data
 * @property {EdgeTypeId} id - A numeric ID (u8)
 * @property {string} stroke_color
 * @property {number} stroke_width
 * @property {Array<number>} line_dash
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
 * @typedef {Object} NodeType
 * @property {string} fill_color - The fill color
 * @property {string} stroke_color - The stroke color
 * @property {number} stroke_width - The stroke width
 * @property {NodeShape} shape - A predifined node shape
 * @property {NodeTypeId} id - A unique numerical node ID (u8)
 * @property {string} name - Human readable name
 * @property {string} metadata - Serialized generic data
 */

/**
 * @typedef {Map<NodeTypeId, NodeType>} NodeTypes
 */

export class GraphEditor extends EventEmitter {
  /** @type {number} */
  scale = 1.0;
  /** @type {import("./typedefs").Coords} */
  pan_coords = { x: 0, y: 0 }
  /** @type {import("./control-panel.js").CoordinateRounder} */
  coordinate_rounder = null;
  /** @type {Map<NodeHandle, NodeBase>} */
  metadata = new Map();
  /** @type {NodeTypes} */
  node_types = new Map();
  /** @type {Map<number, EdgeType>} */
  edge_types = new Map();

  /** @private */
  _wasm;

  /**
   * @param {any} wasm_instance 
   */
  constructor(wasm_instance) {
    super();
    this._wasm = wasm_instance.exports;
    this._memory = this._wasm.memory;
    this._string_buffer_ptr = this._wasm.js_string_buffer.value;
    this._wasm.init();

    this.edge_types.set(-1, {
      stroke_width: 2,
      stroke_color: "#000000",
      id: -1,
      name: "default",
      metadata: "",
      line_dash: []
    })
  }

  /**
   * @param {Array<NodeBase>} nodes
   */
  loadGraph(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      this.createNode(nodes[i], 100, 100 + (80 * i + 1));
    }
  }

  /**
   * @param {number} x 
   * @param {number} y
   * @param {NodeBase} data 
   * @returns {NodeHandle}
   */
  createNode(data, x, y) {
    const {x: w_x, y: w_y} = this.screenToWorld({x, y})
    const node_handle = this._wasm.createNode(w_x, w_y);
    this.metadata.set(node_handle, data);
    this.emit("node:create", { node_handle })
    this.emit("world:update")
    return node_handle;
  }

  /**
   * @param {NodeType} type
   *
   * @returns void
   */
  setNodeType(type) {
    this.node_types.set(type.id, type)
    this.emit("meta:new_node_type", {type})
  }

  /**
   * @param {NodeTypeId} id 
   *
   * @returns {NodeType}
   */
  getNodeType(id) {
    return this.node_types.get(id);
  }

  /**
   * @param {EdgeType} type
   */
  setEdgeType(type) {
    this.edge_types.set(type.id, type);
    this.emit("meta:new_edge_type", {type})
  }

  /**
   * @param {number} id
   * @returns {EdgeType}
   */
  getEdgeType(id) {
    const type = this.edge_types.get(id);
    if (!type) return this.edge_types.get(-1);
    return type;
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
    this.emit("world:pan")
  }

  /**
   * Scale the world
   *
   * @param {number} amount - the amount to zoom
   */
  zoom(amount) {
    this.scale *= amount;
    this.scale = Math.max(0.1, Math.min(this.scale, 6));
    this.emit("world:zoom")
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
      type: metadata.type,
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
   * @returns {Array<Edge>}
   */
  getEdges() {
    const edge_count = this._wasm.getEdgeCount();
    const edges = [];
    for (let i = 0; i < edge_count; i++) {
      const handle = this._wasm.getEdgeHandleByIndex(i);
      edges.push(this.getEdge(handle))
    }
    return edges;
  }

  /**
   * @param {EdgeHandle} handle 
   * @returns {Edge}
   */
  getEdge(handle) {
    return {
      start_handle: this._wasm.getEdgeStartNodeHandle(handle),
      end_handle: this._wasm.getEdgeEndNodeHandle(handle),
      type: this._wasm.getEdgeType(handle),
    }
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
    this.emit("node:update")
  }

  /**
   * Delete a node
   *
   * @param {NodeHandle} handle 
   */
  deleteNode(handle) {
    this._wasm.deleteNode(handle);
    this.metadata.delete(handle);
    this.emit("node:delete", {node_handle: handle})
  }

  /**
   * Delete a node
   *
   * @param {NodeHandle} handle 
   */
  deleteOutgoing(handle) {
    const node = this.getNode(handle)
    if (node.edges_outgoing.length == 0) return;
    for (let i = 0; i < node.edges_outgoing.length; i++) {
      this._wasm.deleteEdge(node.edges_outgoing[i])
    }
    this.emit("edge:delete", {edge_handle: handle})
  }

  /**
   * @returns {Map<string, Array<Edge>>}
   */
  getEdgeBundles() {
    const edges = this.getEdges();

    /** @type {Map<string, Array<Edge>>} */
    const bundles = new Map();
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const key = Math.min(edge.start_handle, edge.end_handle) + '-' + Math.max(edge.start_handle, edge.end_handle);
      if (!bundles.has(key)) {
        bundles.set(key, []);
      }
      bundles.get(key).push(edge);
    }
    return bundles;
  }

  /**
   * @param {NodeHandle} start_handle 
   * @param {NodeHandle} end_handle 
   * @param {NodeHandle} end_handle 
   * @param {EdgeTypeId} type
   */
  createEdge(start_handle, end_handle, type) {
    this._wasm.createEdge(start_handle, end_handle, type);
    this.emit("edge:create", {start_handle, end_handle, type})
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
