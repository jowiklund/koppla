/**
 * @module GraphEditorAPI
 * @description Provides a high level JavaScript for interacting with the core graph
 * logic engine written in Zig
 */

import { assert, assert_is_not_null } from "@kpla/assert";
import { EventEmitter } from "./event-emitter.js";
import { IGraphStore } from "./storage.js";

export { IGraphStore } from "./storage.js";

/** @typedef {number} NodeHandle */
/** @typedef {number} EdgeHandle */
/** @typedef {string} EdgeTypeId */
/** @typedef {string} NodeTypeId */
/** @typedef {string} NodeTypeName */
/** @typedef {number} ZoneType */
/** @typedef {number} GroupType */
/** @typedef {number} CoworkerAuth */
/** @typedef {number} AccessLevel */

/**
 * @typedef {Object} NodeBase
 * @property {string} name - A human readable name displayed underneath the node
 * @property {string} [id] - A human readable name displayed underneath the node
 * @property {NodeTypeId} type - The name of a predefined node style
 * @property {number} x
 * @property {number} y
 * @property {string} metadata
 */

/**
 * @typedef {Object} NodeWasmData
 * @property {Array<EdgeHandle>} edges_outgoing
 * @property {Array<EdgeHandle>} edges_incoming
 * @property {number} x
 * @property {number} y
 * @property {NodeHandle} handle
 *
 * @typedef {NodeBase & NodeWasmData} Node
 */

/**
 * @typedef {Object} EdgeBase
 * @property {string} [id]
 * @property {EdgeTypeId} type
 * @property {string} start_id
 * @property {string} end_id
 */

/**
 * @typedef {Object} EdgeWasmData
 * @property {EdgeHandle} handle
 * @property {EdgeHandle} start_handle
 * @property {EdgeHandle} end_handle
 * @property {EdgeTypeId} type
 *
 * @typedef {EdgeBase & EdgeWasmData} Edge
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
 * @typedef {Object} Relation
 * @property {string} edge_type_metadata
 * @property {string} from_metadata
 * @property {string} to_metadata
 */

/**
 * @typedef Coords
 * @property {number} x
 * @property {number} y
 */

/**
 * @callback CoordinateRounder
 * @param {number} value
 * @returns {number}
 */

export class GraphEditor extends EventEmitter {
  /** @type {number} */
  scale = 1.0;
  /** @type {Coords} */
  pan_coords = { x: 0, y: 0 }
  /** @type {CoordinateRounder} */
  coordinate_rounder = (val) => val;
  /** @type {Map<NodeHandle, NodeBase>} */
  node_data = new Map();
  /** @type {Map<EdgeHandle, EdgeBase>} */
  edge_data = new Map();
  /** @type {Map<NodeTypeId, NodeType>} */
  node_types = new Map();
  /** @type {Map<EdgeTypeId, EdgeType>} */
  edge_types = new Map();

  /** @private */
  _wasm;

  /** @type {IGraphStore} */
  _store;

  /**
   * @param {any} wasm_instance 
   * @param {number} grid_size 
   * @param {IGraphStore} store_instance 
   */
  constructor(wasm_instance, grid_size, store_instance) {
    super();
    this._wasm = wasm_instance.exports;
    this._memory = this._wasm.memory;
    this._string_buffer_ptr = this._wasm.js_string_buffer.value;
    this._wasm.init(grid_size);

    this._store = store_instance
    store_instance.init(this);

    this.edge_types.set("-1", {
      stroke_width: 2,
      stroke_color: "#000000",
      id: "-1",
      name: "default",
      metadata: "",
      line_dash: []
    })
  }

  /**
   * @param {Array<Node>} nodes 
   * @param {Array<Edge>} edges 
   */
  load(nodes, edges) {
    for (const node of nodes) {
      this.createNode(node);
    }
    for (const edge of edges) {
      this.createEdge(edge.end_handle, edge.end_handle, edge.type);
    }
    this.emit("world:loaded");
  }

  sortNodes() {
    this._wasm.sortNodes(10, 0.01, 1000.0, 200.0, 0.9);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   */
  alignHoriz(node_handles) {
    if (node_handles.length === 0) return;
    const [ptr, byte_len] = this._setSelected(node_handles);

    this._wasm.alignHoriz(ptr, node_handles.length);

    this._wasm.free(ptr, byte_len);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   */
  alignVert(node_handles) {
    if (node_handles.length === 0) return;
    const [ptr, byte_len] = this._setSelected(node_handles);

    this._wasm.alignVert(ptr, node_handles.length);

    this._wasm.free(ptr, byte_len);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   */
  evenHoriz(node_handles) {
    if (node_handles.length === 0) return;
    const [ptr, byte_len] = this._setSelected(node_handles);

    this._wasm.evenHoriz(ptr, node_handles.length);

    this._wasm.free(ptr, byte_len);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   */
  evenVert(node_handles) {
    if (node_handles.length === 0) return;
    const [ptr, byte_len] = this._setSelected(node_handles);

    this._wasm.evenVert(ptr, node_handles.length);

    this._wasm.free(ptr, byte_len);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   * @returns {[number, number]} - [ptr, len]
   */
  _setSelected(node_handles) {
    const buffer = this._wasm.memory.buffer;
    const handle_size = 4;

    const byte_len = node_handles.length * handle_size;
    const ptr = this._wasm.alloc(byte_len);

    const node_handles_view = new Uint32Array(buffer, ptr, node_handles.length);

    node_handles_view.set(node_handles);
    return [ptr, byte_len];
  }

  /**
   * @param {NodeBase} data 
   * @returns {NodeHandle}
   */
  createNode(data) {
    const {x, y} = data;
    const {x: w_x, y: w_y} = this.screenToWorld({x, y})
    const node_handle = this._wasm.createNode(w_x, w_y);
    this._store.setNode(node_handle, data)
    this.emit("node:create", { node_handle })
    this.emit("world:update")
    return node_handle;
  }

  /**
   * @param {NodeType} type
   * @param {{[key: string]: string}} colors
   */
  setNodeType(type, colors = {}) {
    this.node_types.set(type.id, type)
    if (Object.keys(colors).includes(type.stroke_color)) {
      type.stroke_color = colors[type.stroke_color]
    }
    if (Object.keys(colors).includes(type.fill_color)) {
      type.fill_color = colors[type.fill_color]
    }
    this.emit("meta:new_node_type", {type})
  }

  /**
   * @returns {Array<Relation>}
   */
  getRelations() {
    const edges = this.getEdges()
    /** @type {Array<Relation>} */
    const relations = [];
    for (let edge of edges) {
      const from_node = this.node_data.get(edge.start_handle);
      const to_node = this.node_data.get(edge.end_handle);
      assert_is_not_null(from_node);
      assert_is_not_null(to_node);
      const edge_type = this.getEdgeType(edge.type);
      const from_metadata = from_node.metadata;
      const to_metadata = to_node.metadata;
      assert_is_not_null(edge_type);
      assert_is_not_null(edge_type.metadata);
      assert_is_not_null(from_metadata);
      assert_is_not_null(to_metadata);

      relations.push({
        edge_type_metadata: edge_type.metadata,
        from_metadata,
        to_metadata,
      })
    }
    return relations;
  }

  /**
   * @param {NodeTypeId} id 
   *
   * @returns {NodeType | undefined}
   */
  getNodeType(id) {
    return this._store.getNodeType(id);
  }

  /**
   * @param {EdgeType} type
   * @param {{[key: string]: string}} colors 
   */
  setEdgeType(type, colors = {}) {
    this.edge_types.set(type.id, type);
    if (Object.keys(colors).includes(type.stroke_color)) {
      type.stroke_color = colors[type.stroke_color]
    }
    this.emit("meta:new_edge_type", {type})
  }

  /**
   * @param {EdgeTypeId} id
   * @returns {EdgeType | undefined}
   */
  getEdgeType(id) {
    const type = this._store.getEdgeType(id);
    if (!type) return this.edge_types.get("-1");
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
    this.emit("world:pan");
    this.emit("world:update");
  }

  /**
   * Scale the world
   *
   * @param {number} amount - the amount to zoom
   */
  zoom(amount) {
    const new_scale = amount *= this.scale;
    this.scale = (Math.max(0.1, Math.min(new_scale, 6)));
    this.emit("world:zoom");
    this.emit("world:update");
  }

  /**
   * Translate coordinates to world coords
   *
   * @param {Coords} screen_coords 
   * @param {boolean} round
   */
  screenToWorld(screen_coords, round = true) {
    const world_x = (screen_coords.x - this.pan_coords.x) / this.scale;
    const world_y = (screen_coords.y - this.pan_coords.y) / this.scale;
    if (round) {
      return {
        x: world_x,
        y: world_y
      }
    }
    return {
      x: world_x,
      y: world_y
    }
  }

  /**
   * Get the a node by its handle
   *
   * @param {number} handle 
   * @returns {Node | null}
   */
  getNode(handle) {
    const data = this._store.getNodeByHandle(handle);
    if (!data) {
      return null;
    }
    /** @type {Node} */
    const node = {
      handle,
      id: data.id,
      x: this._wasm.getNodeX(handle),
      y: this._wasm.getNodeY(handle),
      name: data.name,
      type: data.type,
      edges_outgoing: [],
      edges_incoming: [],
      metadata: data.metadata
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
      if (node == null) continue;
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * @returns {Array<EdgeWasmData>}
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
   * @returns {EdgeWasmData}
   */
  getEdge(handle) {
    return {
      handle,
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
    this._wasm.setNodePosition(handle, x, y);
    const node = this._store.getNodeByHandle(handle)
    if (node != undefined) {
      this._store.setNode(handle, {...node, x, y});
    }
    this.emit("node:update", handle);
    this.emit("world:update");
  }

  persistGraphState() {
    this._store.persistGraphState()
  }

  /**
   * Delete a node
   *
   * @param {NodeHandle} handle 
   */
  deleteNode(handle) {
    this._wasm.deleteNode(handle);
    this.node_data.delete(handle);
    this.emit("node:delete", {node_handle: handle});
    this.emit("world:update");
  }

  /**
   * Delete a node
   *
   * @param {NodeHandle} handle 
   */
  deleteOutgoing(handle) {
    const node = this.getNode(handle)
    if (node == null) return;
    if (node.edges_outgoing.length == 0) return;
    for (let i = 0; i < node.edges_outgoing.length; i++) {
      this._wasm.deleteEdge(node.edges_outgoing[i]);
    }
    this.emit("edge:delete", {edge_handle: handle});
    this.emit("world:update");
  }


  /**
   * @callback FilterCallback
   * @param {EdgeWasmData} edge
   * @returns {boolean}
   */

  /**
   * @param {FilterCallback} [filter_callback] 
   * @returns {Map<string, Array<EdgeWasmData>>}
   */
  getEdgeBundles(filter_callback) {
    let edges = this.getEdges();
    if (filter_callback != undefined) {
      edges = edges.filter(filter_callback)
    }

    /** @type {Map<string, Array<EdgeWasmData>>} */
    const bundles = new Map();
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const key = Math.min(edge.start_handle, edge.end_handle) + '-' + Math.max(edge.start_handle, edge.end_handle);
      if (!bundles.has(key)) {
        bundles.set(key, []);
      }
      assert(bundles.has(key));
      const bundle = bundles.get(key);
      assert_is_not_null(bundle);
      bundle.push(edge);
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
    this.emit("edge:create", {start_handle, end_handle, type});
    this.emit("world:update");
  }
}

/**
 * @param {string | number | object} data 
 */
function print(data) {
  console.log(data)
}

/**
 * @param {string} wasm_url
 * @param {number} grid_size
 * @param {IGraphStore} store
 * @returns {Promise<GraphEditor | null>}
 */
export async function getEngine(wasm_url, grid_size, store) {
  try {
    const wasm_source = await fetch(wasm_url);
    const wasm_buffer = await wasm_source.arrayBuffer();
    const wasm = await WebAssembly.instantiate(wasm_buffer, {
      env: {
        print
      }
    })

    return new GraphEditor(wasm.instance, grid_size, store);
  } catch (err) {
    console.error(err)
    return null
  }
}

