import { CanvasGUIDriver } from "@kpla/canvas-driver"
import { GraphEditor, IGraphStore } from "@kpla/engine";
import wasm_url from '@kpla/engine/public/main.wasm?url';

export class PBStore extends IGraphStore {
    /** @type {Map<string, import("@kpla/engine").NodeType>} */
    node_types = new Map()
    /** @type {Map<string, import("@kpla/engine").EdgeType>} */
    edge_types = new Map()

    /** @type {Map<string, import("@kpla/engine").Node>} */
    nodes_by_id = new Map();
    /** @type {Map<string, import("@kpla/engine").Edge>} */
    edges_by_id = new Map();

    /** @type {string, import("@kpla/engine").NodeHandle} */
    id_to_node_handle = new Map();
    /** @type {import("@kpla/engine").NodeHandle, string} */
    node_handle_to_id = new Map();
    /** @type {string, import("@kpla/engine").NodeHandle} */
    id_to_edge_handle = new Map();
    /** @type {import("@kpla/engine").EdgeHandle, string} */
    edge_handle_to_id = new Map();

    /** @type {Map<string, import("@kpla/engine").Node>} */
    nodes_to_create = new Map();
    /** @type {Map<string, import("@kpla/engine").Node>} */
    nodes_to_update = new Map();
    /** @type {Set<string>} */
    nodes_to_delete = new Set();

    /** @type {Map<string, import("@kpla/engine").Edge>} */
    edges_to_create = new Map();
    /** @type {Map<string, import("@kpla/engine").Edge>} */
    edges_to_update = new Map();
    /** @type {Set<string>} */
    edges_to_delete = new Set();

    /** @type {string} */
    base_url

    throttledPersist = throttle(this._persist.bind(this), 1000)
    constructor(project_id) {
        super();
        this.base_url = `/v-api/project/${project_id}`;
        window.addEventListener("beforeunload", async () => {
            await this.throttledPersist.flush()
        });
    }

    /**
     * @param {GraphEditor} graph 
     */
    async init(graph) {
        await this._loadTypes();
        await this._loadProject(graph); 
    }

    /**
     * @private
     */
    async _loadTypes() {
        try {
            const node_types = await fetch(this.base_url + "/node-types").
                then(res => res.json());
            for (const t of node_types) {
                this.node_types.set(t.id, t);
            }

            /** @type {import("@kpla/engine").EdgeType[]} */
            const edge_types = await fetch(this.base_url + "/edge-types").
                then(res => res.json());
            for (const t of edge_types) {
                this.edge_types.set(t.id, t);
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * @param {GraphEditor} graph 
     */
    async _loadProject(graph) {
        try {
            const nodes = await fetch(this.base_url + "/nodes").then(res => res.json())
            console.log(nodes)
            for (const n of nodes) {
                const node_handle = graph.wasm.createNode(n.x, n.y);
                const full_node_data = {
                    ...n,
                    handle: node_handle,
                    edges_outgoing: [],
                    edges_incoming: [],
                };

                this.nodes_by_id.set(n.id, full_node_data);
                this.id_to_node_handle.set(n.id, node_handle);
                this.node_handle_to_id.set(node_handle, n.id);
            }

            const edges = await fetch(this.base_url + "/edges").then(res => res.json())
            for (const e of edges) {
                const start_handle = this.id_to_node_handle.get(e.start_id);
                const end_handle = this.id_to_node_handle.get(e.end_id)

                if (start_handle !== undefined && end_handle !== undefined) {
                    const edge_handle = graph.wasm.createEdge(start_handle, end_handle);
                    const full_edge_data = {
                        ...e,
                        handle: edge_handle,
                        start_handle,
                        end_handle,
                    }

                    this.edges_by_id.set(e.id, full_edge_data);
                    this.id_to_edge_handle.set(e.id, edge_handle);
                    this.edge_handle_to_id.set(edge_handle, e.id);
                }
            }
        } catch (e) {
            console.error(e)
        }
        graph.emit("world:update")
    }

    setNode(node_handle, node_data) {
        const existing_id = this.node_handle_to_id.get(node_handle);
        let id_to_use = node_data.id || existing_id;
        console.log(node_data)

        if (!id_to_use) {
            id_to_use = crypto.randomUUID()
            this.nodes_to_create.set(id_to_use, {
                ...node_data,
                id: id_to_use,
                handle: node_handle
            })
            this.id_to_node_handle.set(id_to_use, node_handle);
            this.node_handle_to_id.set(node_handle, id_to_use);
            this.nodes_by_id.set(id_to_use, node_data);
        } else {
            const current_node_data = this.nodes_by_id.get(id_to_use);
            this.nodes_by_id.set(id_to_use, {
                ...current_node_data,
                ...node_data, 
                handle: node_handle
            })
            this.nodes_to_update.set(id_to_use, this.nodes_by_id.get(id_to_use))
        }
        console.log(this.nodes_to_update.values())
        this.throttledPersist();
    }

    setEdge(edge_handle, edge_data) {
        const existing_id = this.edge_handle_to_id.get(edge_handle);
        let id_to_use = edge_data.id || existing_id;

        if (!id_to_use) {
            id_to_use = crypto.randomUUID()
            this.edges_to_create.set(id_to_use, {
                ...edge_data,
                id: id_to_use,
                handle: edge_handle
            })
            this.id_to_edge_handle.set(id_to_use, edge_handle);
            this.edge_handle_to_id.set(edge_handle, id_to_use);
        } else {
            const current_edge_data = this.edges_by_id.get(id_to_use);
            this.edges_by_id.set(id_to_use, {
                ...current_edge_data,
                ...edge_data, 
                handle: edge_handle
            })
            this.edges_to_update.set(id_to_use, this.nodes_by_id.get(id_to_use))
        }
    }

    async _persist() {
        const create_nodes_payload = Array.from(this.nodes_to_create.values())
        const update_nodes_payload = Array.from(this.nodes_to_update.values())
        const delete_nodes_payload = Array.from(this.nodes_to_delete.values())

        this.nodes_to_create.clear()
        this.nodes_to_update.clear()
        this.nodes_to_delete.clear()

        await Promise.allSettled([
            create_nodes_payload.length > 0 && fetch(this.base_url + "/create-nodes", {
                method: "POST",
                body: JSON.stringify(create_nodes_payload)
            }).then(res => res.json())
                .then(created_nodes => {
                    for (const temp_node of created_nodes) {
                        const real_id = temp_node.id;
                        const temp_id = temp_node.temp_id;
                        const node_data = this.nodes_by_id.get(temp_id);
                        if (node_data) {
                            node_data.id = real_id;
                            this.nodes_by_id.delete(temp_id);
                            this.nodes_by_id.set(real_id, node_data);
                            const handle = this.id_to_node_handle.get(temp_id);
                            if (handle !== undefined) {
                                this.id_to_node_handle.delete(temp_id);
                                this.id_to_node_handle.set(real_id, handle);
                                this.node_handle_to_id.set(handle, real_id);
                            }
                        }
                    }

            }),
            update_nodes_payload.length && fetch(this.base_url + "/update-nodes", {
                method: "PUT",
                body: JSON.stringify(update_nodes_payload)
            }),
            delete_nodes_payload.length && fetch(this.base_url + "/delete-nodes", {
                method: "DELETE",
                body: JSON.stringify(delete_nodes_payload)
            })
        ]).catch(e => console.error("Persistance error:", e))

        const create_edges_payload = Array.from(this.edges_to_create.values())
        const update_edges_payload = Array.from(this.edges_to_update.values())
        const delete_edges_payload = Array.from(this.edges_to_delete.values())

        this.edges_to_create.clear()
        this.edges_to_update.clear()
        this.edges_to_delete.clear()

        await Promise.allSettled([
            create_edges_payload.length > 0 && fetch(this.base_url + "/create-edges", {
                method: "POST",
                body: JSON.stringify(create_edges_payload)
            }).then(res => res.json())
                .then(created_edges => {
                    for (const temp_edge of created_edges) {
                        const real_id = temp_edge.id;
                        const temp_id = temp_edge.temp_id;
                        const edge_data = this.edges_by_id.get(temp_id);
                        if (edge_data) {
                            edge_data.id = real_id;
                            this.edges_by_id.delete(temp_id);
                            this.edges_by_id.set(real_id, edge_data);
                            const handle = this.id_to_edge_handle.get(temp_id);
                            if (handle !== undefined) {
                                this.id_to_edge_handle.delete(temp_id);
                                this.id_to_edge_handle.set(real_id, handle);
                                this.edge_handle_to_id.set(handle, real_id);
                            }
                        }
                    }

            }),
            update_edges_payload.length && fetch(this.base_url + "/update-edges", {
                method: "PUT",
                body: JSON.stringify(update_edges_payload)
            }),
            delete_edges_payload.length && fetch(this.base_url + "/delete-edges", {
                method: "DELETE",
                body: JSON.stringify(delete_edges_payload)
            })
        ]).catch(e => console.error("Persistance error:", e))
    }

    /**
     * @param {import("@kpla/engine").NodeHandle} node_handle 
     * @returns {import("@kpla/engine").Node | undefined}
     */
    getNodeByHandle(node_handle) {
        const id = this.node_handle_to_id.get(node_handle);
        if (!id) return undefined;
        return this.nodes_by_id.get(id)
    }

    /**
     * @param {import("@kpla/engine").EdgeHandle} node_handle 
     * @returns {import("@kpla/engine").Edge | undefined}
     */
    getEdgeByHandle(edge_handle) {
        const id = this.edge_handle_to_id.get(edge_handle);
        if (!id) return undefined;
        return this.edges_by_id.get(id)
    }

    /**
     * @param {string} node_id 
     * @returns {import("@kpla/engine").Node | undefined}
     */
    getNodeById(node_id) {
        return this.nodes_by_id.get(node_id);
    }

    /**
     * @param {import("@kpla/engine").NodeHandle} node_handle 
     */
    deleteNode(node_handle) {
        const id = this.node_handle_to_id.get(node_handle);
        if (id) {
            this.nodes_by_id.delete(id);
            this.id_to_node_handle.delete(id);
            this.node_handle_to_id.delete(node_handle);
            this.nodes_to_delete.add(id);
            this.nodes_to_create.delete(id);
            this.nodes_to_update.delete(id);

            this.throttledPersist();
        }
    }

    /**
     * @param {import("@kpla/engine").NodeTypeId} id 
     * @returns {import("@kpla/engine").NodeType}
     */
    getNodeType(id) {
        return this.node_types.get(id)
    }

    /**
     * @param {import("@kpla/engine").EdgeTypeId} id
     * @returns {import("@kpla/engine").EdgeType}
     */
    getEdgeType(id) {
        return this.edge_types.get(id)
    }
}


export const driver = new CanvasGUIDriver({
    container_id: "canvas-container",
    control_panel_id: "control-panel",
    wasm_url
})

/**
 * Creates a throttled function that only invokes the provided function `func`
 * at most once per every `delay` milliseconds.
 *
 * This version of throttle does not fire on the leading edge.
 *
 * The throttled function comes with a `cancel` method to cancel delayed
 * `func` invocations and a `flush` method to immediately invoke them.
 *
 * @param {Function} func The function to throttle.
 * @param {number} delay The number of milliseconds to throttle invocations to.
 * @returns {Function} Returns the new throttled function.
 */
export function throttle(func, delay) {
  /** @type {ReturnType<typeof setTimeout> | null} Stores the timer ID from setTimeout. */
  let timeout_id = null;
  /** @type {any[] | null} Stores the arguments of the last call. */
  let last_args = null;
  /** @type {any} Stores the `this` context of the last call. */
  let last_this = null;
  /** @type {any} Stores the result of the last `func` invocation. */
  let result;
  /** @type {number} Timestamp of the last time `func` was invoked. */
  let last_call_time = 0; // Keep track of the last time a timeout was set for trailing

  /**
   * The core throttled function that manages the invocation of the original function.
   * It's called every time the event fires.
   * @param {...any} args The arguments to pass to the original function.
   * @returns {any} Returns the result of the last successful invocation of `func`.
   */
  function throttled(...args) {
    const now = Date.now();
    last_args = args;
    last_this = this;

    if (!timeout_id) {
      // If there's no active timeout, set one for the trailing edge.
      timeout_id = setTimeout(() => {
        last_call_time = Date.now();
        timeout_id = null;
        result = func.apply(last_this, last_args);
        // Clear args and this if there's no pending timeout.
        if (!timeout_id) { // Check again in case func triggered another throttle
          last_args = last_this = null;
        }
      }, delay);
    }
    // The result from the previous invocation is returned immediately.
    // If it's the first call, result will be undefined until the timeout fires.
    return result;
  }

  /**
   * Cancels the pending delayed invocation of the throttled function.
   * Any trailing edge call that has been scheduled will be cancelled.
   */
  throttled.cancel = function() {
    if (timeout_id) {
      clearTimeout(timeout_id);
      timeout_id = null;
    }
    last_call_time = 0;
    last_args = last_this = null;
  };

  /**
   * Immediately invokes the throttled function if there's a pending execution.
   * This is useful for flushing a final call, for example, on an unmount event.
   * @returns {any} The result of the flushed function invocation.
   */
  throttled.flush = function() {
    if (!timeout_id) {
      return result;
    }
    // Effectively a trailing edge invocation, but executed immediately.
    clearTimeout(timeout_id);
    timeout_id = null;
    last_call_time = Date.now();

    result = func.apply(last_this, last_args);
    if (!timeout_id) { // Check again in case func triggered another throttle
      last_args = last_this = null;
    }
    return result;
  };

  return throttled;
}
