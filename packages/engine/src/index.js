/**
 * @module GraphEditorAPI
 * @description Provides a high level JavaScript for interacting with the core graph
 * logic engine written in Zig
 */

import { assert, assert_is_not_null } from "@kpla/assert";
import { EventEmitter } from "./event-emitter.js";
import { IGraphStore } from "./storage.js";
import { IWriter } from "./writer.js";

export { IGraphStore } from "./storage.js";
export { IWriter } from "./writer.js"

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
 * @property {number[]} line_dash
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

  /** @type {any} */
  wasm;

  /** @type {IGraphStore} */
  store;

  /** @type {Promise<void>} */
  store_loaded;

  /**
   * @param {any} wasm_instance 
   * @param {number} grid_size 
   * @param {IGraphStore} store_instance 
   */
  constructor(wasm_instance, grid_size, store_instance) {
    super();
    this.wasm = wasm_instance.exports;
    this._memory = this.wasm.memory;
    this._string_buffer_ptr = this.wasm.js_string_buffer.value;
    this.wasm.init(grid_size);

    this.store = store_instance
    this.store_loaded = store_instance.init(this);

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
   * @param {IWriter} writer 
   * @param {import("./writer.js").RelationshipRuleset[]} rules 
   */
  async import(writer, rules) {
    await writer.write(this, rules);
    this.emit("world:update");
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
      this.createEdge(edge);
    }
    this.emit("world:loaded");
  }

  /**
   * @returns {{top_left: Coords, bottom_right: Coords}}
   */
  getWorldBounds() {
    const nodes = this.getNodes()
    const min_x = Math.min(...nodes.map(n => n.x))
    const max_x = Math.max(...nodes.map(n => n.x))
    const min_y = Math.min(...nodes.map(n => n.y))
    const max_y = Math.max(...nodes.map(n => n.y))
    return {
      top_left: {
        x: min_x,
        y: min_y
      },
      bottom_right: {
        x: max_x,
        y: max_y
      }
    }
  }

  sortNodes() {
    this.wasm.sortNodes(500, 0.001, 1000.0, 200.0, 0.9);
    for (const node of this.getNodes()) {
      this.store.setNode(node.handle, node)
    }
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   */
  alignHoriz(node_handles) {
    if (node_handles.length === 0) return;
    const [ptr, byte_len] = this._setSelected(node_handles);

    this.wasm.alignHoriz(ptr, node_handles.length);

    for (const h of node_handles) {
      const node = this.getNode(h)
      if (node == undefined) continue;
      this.store.setNode(h, node);
    }

    this.wasm.free(ptr, byte_len);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   */
  alignVert(node_handles) {
    if (node_handles.length === 0) return;
    const [ptr, byte_len] = this._setSelected(node_handles);

    this.wasm.alignVert(ptr, node_handles.length);

    for (const h of node_handles) {
      const node = this.getNode(h)
      if (node == undefined) continue;
      this.store.setNode(h, node);
    }

    this.wasm.free(ptr, byte_len);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   */
  evenHoriz(node_handles) {
    if (node_handles.length === 0) return;
    const [ptr, byte_len] = this._setSelected(node_handles);

    this.wasm.evenHoriz(ptr, node_handles.length);

    for (const h of node_handles) {
      const node = this.getNode(h)
      if (node == undefined) continue;
      this.store.setNode(h, node);
    }

    this.wasm.free(ptr, byte_len);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   */
  evenVert(node_handles) {
    if (node_handles.length === 0) return;
    const [ptr, byte_len] = this._setSelected(node_handles);

    this.wasm.evenVert(ptr, node_handles.length);

    for (const h of node_handles) {
      const node = this.getNode(h)
      if (node == undefined) continue;
      this.store.setNode(h, node);
    }

    this.wasm.free(ptr, byte_len);
    this.emit("world:update");
  }

  /**
   * @param {NodeHandle[]} node_handles 
   * @returns {[number, number]} - [ptr, len]
   */
  _setSelected(node_handles) {
    const buffer = this.wasm.memory.buffer;
    const handle_size = 4;

    const byte_len = node_handles.length * handle_size;
    const ptr = this.wasm.alloc(byte_len);

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

    const node_handle = this.wasm.createNode(w_x, w_y);
    const wasm_x = this.wasm.getNodeX(node_handle);
    const wasm_y = this.wasm.getNodeY(node_handle);

    this.store.setNode(node_handle, {
      ...data,
      x: wasm_x,
      y: wasm_y
    });

    this.emit("node:create", { node_handle });
    this.emit("world:update");
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
    return this.store.getNodeType(id);
  }
  /**
   * @returns {NodeType[]}
   */
  getNodeTypes() {
    return this.store.getNodeTypes();
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
    const type = this.store.getEdgeType(id);
    return type;
  }

  /**
   * @returns {EdgeType[]}
   */
  getEdgeTypes() {
    return this.store.getEdgeTypes();
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
   */
  screenToWorld(screen_coords) {
    const world_x = (screen_coords.x - this.pan_coords.x) / this.scale;
    const world_y = (screen_coords.y - this.pan_coords.y) / this.scale;
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
    const data = this.store.getNodeByHandle(handle);
    if (!data) return null;

    /** @type {Node} */
    const node = {
      handle,
      id: data.id,
      x: this.wasm.getNodeX(handle),
      y: this.wasm.getNodeY(handle),
      name: data.name,
      type: data.type,
      edges_outgoing: [],
      edges_incoming: [],
      metadata: data.metadata
    }

    const edges_out_len = this.wasm.getNodeOutgoingCount(handle);
    for (let i = 0; i < edges_out_len; i++) {
      const edge_out = this.wasm.getNodeOutgoingHandleByIndex(handle, i);
      node.edges_outgoing.push(edge_out);
    }

    const edges_in_len = this.wasm.getNodeIncomingCount(handle);
    for (let i = 0; i < edges_in_len; i++) {
      const edge_in = this.wasm.getNodeIncomingHandleByIndex(handle, i);
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
    const node_count = this.wasm.getNodeCount();

    const nodes = [];

    for (let i = 0; i < node_count; i++) {
      const handle = this.wasm.getNodeHandleByIndex(i);
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
    const edge_count = this.wasm.getEdgeCount();
    const edges = [];
    for (let i = 0; i < edge_count; i++) {
      const handle = this.wasm.getEdgeHandleByIndex(i);
      const edge = this.getEdge(handle)
      if (edge == null) continue;
      edges.push(edge)
    }
    return edges;
  }

  /**
   * @param {EdgeHandle} handle 
   * @returns {EdgeWasmData | null}
   */
  getEdge(handle) {
    const e = this.store.getEdgeByHandle(handle)
    if (e == undefined) return null;
    return {
      handle,
      start_handle: this.wasm.getEdgeStartNodeHandle(handle),
      end_handle: this.wasm.getEdgeEndNodeHandle(handle),
      type: e.type
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
    this.wasm.setNodePosition(handle, x, y);

    const node_data = this.store.getNodeByHandle(handle)
    if (node_data != undefined) {
      this.store.setNode(handle, {
        ...node_data,
        x: this.wasm.getNodeX(handle),
        y: this.wasm.getNodeY(handle)
      });
    }

    this.emit("node:update", handle);
    this.emit("world:update");
  }

  /**
   * Delete a node
   *
   * @param {NodeHandle} handle 
   */
  deleteNode(handle) {
    const node = this.getNode(handle);
    if (node !== null) {
      for (const e of node.edges_outgoing) {
        this.deleteEdge(e)
      }
      for (const e of node.edges_incoming) {
        this.deleteEdge(e)
      }
    }
    this.wasm.deleteNode(handle);
    this.store.deleteNode(handle);
    this.emit("node:delete", {node_handle: handle});
    this.emit("world:update");
  }

  /**
   * Delete an edge
   *
   * @param {NodeHandle} handle 
   */
  deleteEdge(handle) {
    this.wasm.deleteEdge(handle);
    this.store.deleteEdge(handle);
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
      this.deleteEdge(node.edges_outgoing[i]);
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
   * @param {EdgeBase} edge_data 
   */
  async createEdge(edge_data) {
    const start_handle = this.store.getNodeHandleById(edge_data.start_id);
    const end_handle = this.store.getNodeHandleById(edge_data.end_id);
    assert_is_not_null(start_handle)
    assert_is_not_null(end_handle)
    const edge_handle = this.wasm.createEdge(start_handle, end_handle);
    if (end_handle === undefined || start_handle === undefined) {
      throw new Error("Node handles don't exist")
    }
    await this.store.setEdge(edge_handle, {
      ...edge_data,
      start_handle: start_handle,
      end_handle: end_handle,
      handle: edge_handle
    })
    this.emit("edge:create", edge_data);
    this.emit("world:update");
  }

  /**
   * @param {Edge[]} edges 
   */
  async createEdges(edges) {
    for (const edge of edges) {
      await this.createEdge(edge)
    }
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

