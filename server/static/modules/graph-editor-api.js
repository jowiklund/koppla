/**
 * @module GraphEditorAPI
 * @description Provides a high level JavaScript for interacting with the core graph
 * logic engine written in Zig
 */

/** @typedef {number} NodeHandle */
/** @typedef {number} EdgeHandle */

/**
 * @typedef {Object} Node
 * @property {number} x
 * @property {number} y
 * @property {number} type
 * @property {NodeHandle} handle
 * @property {string} name
 */

/**
 * @typedef {Object} Edge
 * @property {NodeHandle} start_handle
 * @property {NodeHandle} end_handle
 */

export class GraphEditor {
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
   * @param {WebAssembly.WebAssemblyInstantiatedSource.instance} wasm_instance 
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

    this.CoworkerAuth = {
      admin: this._wasm.getCoworkerAuthAdmin(),
      manager: this._wasm.getCoworkerAuthManager(),
      internal: this._wasm.getCoworkerAuthInternal(),
      guest: this._wasm.getCoworkerAuthGuest(),
    };

    this.AccessLevel = {
      access: this._wasm.getAccessLevelAccess(),
      manage: this._wasm.getAccessLevelManage(),
      add: this._wasm.getAccessLevelAdd(),
      modify: this._wasm.getAccessLevelModify(),
      update: this._wasm.getAccessLevelUpdate(),
    };

    this.GraphNodeType = {
      coworker: 0,
      group: 1,
      zone: 2,
      access_connector: 3
    };
  }

  /** @private */
  _writeStringToWasm(str) {
    const encoded = this._text_encoder.encode(str);
    const view = new Uint8Array(this._memory.buffer, this._string_buffer_ptr, 256);
    view.set(encoded);

    if (encoded.length < 256) {
      view[encoded.length] = 0;
    }

    return encoded.length;
  }

  /** @private */
  _readStringFromWasm(ptr, len) {
    const buffer = new Uint8Array(this._memory.buffer, ptr, len);
    return this._text_decoder.decode(buffer);
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
    return this._wasm.createGroupNode(x, y, len);
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
    return this._wasm.createZoneNode(x, y, len, type);
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
    return this._wasm.createCoworkerNode(x, y, len, auth);
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
    return this._wasm.createAccessConnectorNode(x, y, len, level);
  }

  /**
   * Get the a node by its handle
   *
   * @returns {Node}
   */
  getNode(handle) {
    const name_ptr = this._wasm.getNodeNamePtr(handle);
    const name_len = this._wasm.getNodeNameLen(handle);
    const name = this._readStringFromWasm(name_ptr, name_len);

    return {
      handle,
      x: this._wasm.getNodeX(handle),
      y: this._wasm.getNodeY(handle),
      type: this._wasm.getGraphObjectType(handle),
      name
    }
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
  }

  /**
   * Get an edge by its' index in memory
   *
   * @param {number} index 
   *
   * @returns {Edge}
   */
  getEdgeByIndex(index) {
    const start_handle = this._wasm.getEdgeStartNode(index);
    const end_handle = this._wasm.getEdgeEndNode(index);

    return {
      start_handle,
      end_handle
    }
  }

  /**
   * @returns {Map<string, Array<Edge>>}
   */
  getEdgeBundles() {
    const bundles = new Map();
    const edge_count = this._wasm.getEdgeCount();

    for (let i = 0; i < edge_count; i++) {
      const {start_handle, end_handle} = this.getEdgeByIndex(i);
      const key = Math.min(start_handle, end_handle) + '-' + Math.max(start_handle, end_handle);

      if (!bundles.has(key)) {
        bundles.set(key, []);
      }

      bundles.get(key).push({start_handle, end_handle})
    }
    return bundles;
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
 * @returns {Promise<GraphEditor | null>}
 */
export async function getEngine() {
  try {
    const wasm_source = await fetch("main.wasm");
    const wasm_buffer = await wasm_source.arrayBuffer();
    const wasm = await WebAssembly.instantiate(wasm_buffer, {
      env: {
        print: (data) => {
          console.log(data)
        }
      }
    })

    return new GraphEditor(wasm.instance);
  } catch (err) {
    return null
  }
}
