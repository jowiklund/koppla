import { CanvasGUIDriver } from "@kpla/canvas-driver"
import { GraphEditor, IGraphStore } from "@kpla/engine";
import wasm_url from '@kpla/engine/public/main.wasm?url';

export class PBStore extends IGraphStore {
    /** @type {string} */
    base_url
    /** @type {Map<string, import("@kpla/engine").NodeType>} */
    node_types = new Map()
    /** @type {Map<string, import("@kpla/engine").EdgeType>} */
    edge_types = new Map()
    /** @type {Map<import("@kpla/engine").NodeHandle, import("@kpla/engine").NodeBase>} */
    node_cache = new Map()
    /** @type {Map<import("@kpla/engine").EdgeHandle, import("@kpla/engine").EdgeBase>} */
    edge_cache = new Map()
    /** @type {Map<string, number>} */
    id_to_handle = new Map()

    /**
   * @param {string} base_url 
   */
    constructor(project_id) {
        super();
        this.base_url = `/v-api/project/${project_id}`;
    }

    /**
     * @param {GraphEditor} graph 
     */
    async init(graph) {
        await this._load_types();
        await this._load_project(graph);
    }

    /**
     * @private
     */
    async _load_types() {
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
     * @private
     */
    async _load_project(graph) {
        try {
            /** @type {import("@kpla/engine").NodeBase[]} */
            const nodes = await fetch(this.base_url + "/nodes").
                then(res => res.json());
            for (const n of nodes) {
                graph.createNode(n)
            }
            /** @type {import("@kpla/engine").EdgeBase[]} */
            const edges = await fetch(this.base_url + "/edges").
                then(res => res.json());
            for (const e of edges) {
                const start_handle = this.getNodeHandleById(e.start_id);
                const end_handle = this.getNodeHandleById(e.end_id);
                graph.createEdge(start_handle, end_handle, e.type)
            }

        } catch (e) {
            console.error(e);
        }
    }

    /**
     * @param {import("@kpla/engine").NodeHandle} node_handle 
     * @param {import("@kpla/engine").NodeBase} node_data
     */
    async setNode(node_handle, node_data) {
        if (node_data.id != undefined) {
            fetch(this.base_url + "/update-node", {
                method: "PUT",
                body: JSON.stringify(node_data)
            })
            this.id_to_handle.set(node_data.id, node_handle);
            this.node_cache.set(node_handle, node_data);
            return
        }

        /** @type {import("@kpla/engine").NodeBase} */
        const new_node = await fetch(this.base_url + "/create-node", {
            method: "POST",
            body: node_data
        }).then(res => res.json())

        this.id_to_handle.set(new_node.id, node_handle);
        this.node_cache.set(node_handle, new_node);
    }

    /**
     * @param {import("@kpla/engine").NodeHandle} node_handle 
     * @returns {import("@kpla/engine").NodeBase | undefined}
     */
    getNodeByHandle(node_handle) {
        return this.node_cache.get(node_handle);
    }

    /**
     * @param {string} node_id 
     * @returns {import("@kpla/engine").NodeBase | undefined}
     */
    getNodeById(node_id) {
        const handle = this.id_to_handle.get(node_id);
        if (!handle) return undefined;

        return this.node_cache.get(handle);
    }

    /**
     * @param {string} node_id 
     * @returns {import("@kpla/engine").NodeHandle | undefined}
     */
    getNodeHandleById(node_id) {
        return this.id_to_handle.get(node_id);
    }

    /**
     * @param {import("@kpla/engine").NodeHandle} node_handle 
     */
    deleteNode(node_handle) {
        throw new Error("Method 'deleteNode' is not implemented")
    }

    /**
     * @param {import("@kpla/engine").EdgeHandle} edge_handle 
     * @param {import("@kpla/engine").EdgeBase} edge_data
     */
    setEdge(edge_handle, edge_data) {
        this.edge_cache.set(edge_handle, edge_data);
        this.id_to_handle.set(edge_data.id, edge_handle);
    }

    /**
     * @param {import("@kpla/engine").EdgeHandle} edge_handle 
     * @returns {import("@kpla/engine").EdgeBase | undefined}
     */
    getEdgeByHandle(edge_handle) {
        return this.edge_cache.get(edge_handle)
    }

    /**
     * @param {string} edge_id 
     * @returns {import("@kpla/engine").EdgeBase | undefined}
     */
    getEdgeById(edge_id) {
        const handle = this.id_to_handle.get(edge_id);
        if (!handle) return undefined;

        return this.node_cache.get(handle);
    }

    /**
     * @param {string} edge_id 
     * @returns {import("@kpla/engine").EdgeHandle | undefined}
     */
    getEdgeHandleById(edge_id) {
        return this.id_to_handle.get(edge_id)
    }

    /**
     * @param {import("@kpla/engine").EdgeHandle} edge_handle 
     */
    deleteEdge(edge_handle) {
        throw new Error("Method 'deleteEdge' is not implemented")
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

// window.canvas_gui.run({
//   edge_types,
//   node_types
// }, [
//     {
//       name: "Product owners",
//       type: "qgo5vvmzgdmdhs3",
//       edges_outgoing: [],
//       edges_incoming: [],
//       metadata: '{"id": "po"}'
//     },
//     {
//       name: "Developers",
//       type: "qgo5vvmzgdmdhs3",
//       edges_outgoing: [],
//       edges_incoming: [],
//       metadata: '{"id": "devs"}'
//     },
//   ]).then((graph) => {
//     const log_save = throttle(() => {
//       console.log({
//         nodes: graph.getNodes(),
//         edges: graph.getEdges()
//       })
//     }, 2000)
//     graph.on("world:update", log_save)
//   })

