/**
 * @module GraphEditorAPI
 * @description Provides a high level JavaScript for interacting with the core graph
 * logic engine written in Zig
 */

import { assert_is_number } from "./assert.js";

/** @typedef {number} NodeHandle */
/** @typedef {number} EdgeHandle */
/** @typedef {number} ZoneType */
/** @typedef {number} GroupType */
/** @typedef {number} CoworkerAuth */
/** @typedef {number} AccessLevel */

/**
 * @typedef {Object} Node
 * @property {number} x
 * @property {number} y
 * @property {number} type
 * @property {NodeHandle} handle
 * @property {string} name
 * @property {Array<NodeHandle>} edges_outgoing
 * @property {Array<NodeHandle>} edges_incoming
 */

/**
 * @typedef {Object} Edge
 * @property {NodeHandle} start_handle
 * @property {NodeHandle} end_handle
 */

/**
 * @param {unknown} value 
 * @param {GraphEditor} graph 
 * @returns {asserts value is ZoneType}
 */
export function assert_is_zonetype(value, graph) {
  assert_is_number(value)
  if (!Object.values(graph.ZoneType).includes(value)) {
    throw new Error(`Invalid zone type :: ${value}`)
  }
}

/**
 * @param {unknown} value 
 * @param {GraphEditor} graph 
 * @returns {asserts value is ZoneType}
 */
export function assert_is_coworker_auth(value, graph) {
  assert_is_number(value)
  if (!Object.values(graph.CoworkerAuth).includes(value)) {
    throw new Error(`Invalid coworker auth :: ${value}`);
  }
}

export class GraphEditor {
  /** @type {number} */
  scale = 1.0;
  /** @type {import("./typedefs").Coords} */
  pan_coords = {
    x: 0,
    y: 0
  }
  /** @type {import("./control-panel.js").CoordinateRounder} */
  coordinate_rounder = null;
  /** @type {Map<NodeHandle, import("./metadata.js").Metadata>} */
  metadata = new Map();
  /** @private */
  _wasm;
  /** @private */
  _memory;
  /** @private */
  _string_buffer_ptr;
  /** @private */
  _text_encoder = new TextEncoder();
  /** @private */
  _text_decoder = new TextDecoder();

  /**
   * @param {any} wasm_instance 
   */
  constructor(wasm_instance) {
    this._wasm = wasm_instance.exports;
    this._memory = this._wasm.memory;
    this._string_buffer_ptr = this._wasm.js_string_buffer.value;
    this._wasm.init();

    this.ZoneType = {
      personal: this._wasm.getZoneTypePersonal(),
      read_protected: this._wasm.getZoneTypeReadProtected(),
      normal: this._wasm.getZoneTypeNormal(),
    };

    this.zone_type_names = {
      [this.ZoneType.personal]: "Personal",
      [this.ZoneType.read_protected]: "Read protected",
      [this.ZoneType.normal]: "Normal",
    };

    this.CoworkerAuth = {
      admin: this._wasm.getCoworkerAuthAdmin(),
      manager: this._wasm.getCoworkerAuthManager(),
      internal: this._wasm.getCoworkerAuthInternal(),
      guest: this._wasm.getCoworkerAuthGuest(),
    };

    this.coworker_auth_names = {
      [this.CoworkerAuth.admin]: "Administrator",
      [this.CoworkerAuth.guest]: "Guest",
      [this.CoworkerAuth.manager]: "Manager",
      [this.CoworkerAuth.internal]: "Internal",
    };

    this.AccessLevel = {
      access: this._wasm.getAccessLevelAccess(),
      manage: this._wasm.getAccessLevelManage(),
      add: this._wasm.getAccessLevelAdd(),
      modify: this._wasm.getAccessLevelModify(),
      update: this._wasm.getAccessLevelUpdate(),
    };

    this.coworker_auth_names = {
      [this.AccessLevel.add]: "Add",
      [this.AccessLevel.manage]: "Manage",
      [this.AccessLevel.access]: "Access",
      [this.AccessLevel.modify]: "Modify",
      [this.AccessLevel.update]: "Update",
    };

    this.GraphNodeType = {
      coworker: 0,
      group: 1,
      zone: 2,
      access_connector: 3
    };
  }

  /**
   * @private
   * @param {string} str 
   */
  _writeStringToWasm(str) {
    const encoded = this._text_encoder.encode(str);
    const view = new Uint8Array(this._memory.buffer, this._string_buffer_ptr, 256);
    view.set(encoded);

    if (encoded.length < 256) {
      view[encoded.length] = 0;
    }

    return encoded.length;
  }

  /**
   * @private
   * @param {number} ptr 
   * @param {number} len 
   */
  _readStringFromWasm(ptr, len) {
    const buffer = new Uint8Array(this._memory.buffer, ptr, len);
    return this._text_decoder.decode(buffer);
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
   * Creates a new Group node in the graph.
   * @param {number} x The X coordinate.
   * @param {number} y The Y coordinate.
   * @param {string} name The name of the group.
   * @returns {NodeHandle} The handle to the newly created node.
   */
  createGroupNode(x, y, name) {
    const len = this._writeStringToWasm(name);
    const {x: w_x, y: w_y} = this.screenToWorld({x, y})
    const handle = this._wasm.createGroupNode(this.coordinate_rounder(w_x), this.coordinate_rounder(w_y), len);
    this.metadata.set(handle, {
      type: "group",
      name,
      id: ""
    })
    return handle;
  }

  /**
   * Creates a new Zone node in the graph.
   * @param {number} x The X coordinate.
   * @param {number} y The Y coordinate.
   * @param {string} name The name of the zone.
   * @param {number} type The zone type.
   * @returns {NodeHandle} The handle to the newly created node.
   */
  createZoneNode(x, y, name, type) {
    const len = this._writeStringToWasm(name);
    const {x: w_x, y: w_y} = this.screenToWorld({x, y})
    const handle = this._wasm.createZoneNode(w_x, w_y, len, type);
    this.metadata.set(handle, {
      type: "zone",
      id: "",
      name,
      zone_type: type
    })
    return handle;
  }

  /**
   * Creates a new coworker node in the graph.
   * @param {number} x The X coordinate.
   * @param {number} y The y coordinate.
   * @param {string} name The name of the coworker.
   * @param {number} auth The authorization level.
   */
  createCoworkerNode(x, y, name, auth) {
    const len = this._writeStringToWasm(name);
    const {x: w_x, y: w_y} = this.screenToWorld({x, y})
    const handle = this._wasm.createCoworkerNode(w_x, w_y, len, auth);
    this.metadata.set(handle, {
      type: "coworker",
      name,
      id: "",
      auth
    })
    return handle;
  }

  /**
   * Creates a new Access node in the graph.
   * @param {number} x The X coordinate.
   * @param {number} y The Y coordinate.
   * @param {number} level The access level.
   * @returns {NodeHandle} The handle to the newly created node.
   */
  createAccessNode(x, y, level) {
    let name = "";
    const {x: w_x, y: w_y} = this.screenToWorld({x, y})
    switch (level) {
      case this.AccessLevel.manage:
        name = "Manage";
        break;
      case this.AccessLevel.add:
        name = "Add";
        break;
      case this.AccessLevel.access:
        name = "Access";
        break;
      case this.AccessLevel.modify:
        name = "Modify";
        break;
      case this.AccessLevel.update:
        name = "Update";
        break;
      default:
        throw new Error("Invalid access level")
    }
    const len = this._writeStringToWasm(name);
    const handle = this._wasm.createAccessConnectorNode(w_x, w_y, len, level);
    this.metadata.set(handle, {
      type: "access_node",
      id: "",
      name,
      access_level: level
    })
    return handle;
  }

  /**
   * Get the a node by its handle
   * @param {number} handle 
   * @returns {Node}
   */
  getNode(handle) {
    const name_ptr = this._wasm.getNodeNamePtr(handle);
    const name_len = this._wasm.getNodeNameLen(handle);
    const name = this._readStringFromWasm(name_ptr, name_len);

    const node = {
      handle,
      x: this._wasm.getNodeX(handle),
      y: this._wasm.getNodeY(handle),
      edges_outgoing: [],
      edges_incoming: [],
      type: this._wasm.getGraphObjectType(handle),
      name
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
