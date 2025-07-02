import { GraphEditor } from ".";

/**
 * @interface IGraphStore
 * @description Interface for generic graph data storage
 */
export class IGraphStore {
    /**
     * @param {GraphEditor} graph_editor 
     */
    async init(graph_editor) {
        throw new Error("Method 'init' is not implemented")
    }

    /**
     * @param {import(".").NodeHandle} node_handle 
     * @param {import(".").NodeBase} node_data
     */
    setNode(node_handle, node_data) {
        throw new Error("Method 'setNode' is not implemented")
    }

    /**
     * @param {import(".").NodeHandle} node_handle 
     * @returns {import(".").NodeBase | undefined}
     */
    getNodeByHandle(node_handle) {
        throw new Error("Method 'getNodeByHandle' is not implemented")
    }

    /**
     * @param {string} node_id 
     * @returns {import(".").NodeBase | undefined}
     */
    getNodeById(node_id) {
        throw new Error("Method 'getNodeById' is not implemented")
    }

    /**
     * @param {string} node_id 
     * @returns {import(".").NodeHandle | undefined}
     */
    getNodeHandleById(node_id) {
        throw new Error("Method 'getHandleById' is not implemented")
    }

    /**
     * @param {import(".").NodeHandle} node_handle 
     */
    deleteNode(node_handle) {
        throw new Error("Method 'deleteNode' is not implemented")
    }

    /**
     * @param {import(".").EdgeHandle} edge_handle 
     * @param {import(".").EdgeBase} edge_data
     */
    setEdge(edge_handle, edge_data) {
        throw new Error("Method 'setEdge' is not implemented")
    }

    /**
     * @param {import(".").EdgeHandle} edge_handle 
     * @returns {import(".").EdgeBase | undefined}
     */
    getEdgeByHandle(edge_handle) {
        throw new Error("Method 'getEdgeByHandle' is not implemented")
    }

    /**
     * @param {string} edge_id 
     * @returns {import(".").EdgeBase | undefined}
     */
    getEdgeById(edge_id) {
        throw new Error("Method 'getEdgeById' is not implemented")
    }

    /**
     * @param {string} edge_id 
     * @returns {import(".").EdgeHandle | undefined}
     */
    getEdgeHandleById(edge_id) {
        throw new Error("Method 'getEdgeHandleById' is not implemented")
    }

    /**
     * @param {import(".").EdgeHandle} edge_handle 
     */
    deleteEdge(edge_handle) {
        throw new Error("Method 'deleteEdge' is not implemented")
    }

    /**
     * @param {import(".").NodeTypeId} id 
     * @returns {import(".").NodeType}
     */
    getNodeType(id) {
        throw new Error("Method 'getNodeType' is not implemented")
    }

    /**
     * @param {import(".").EdgeTypeId} id
     * @returns {import(".").EdgeType}
     */
    getEdgeType(id) {
        throw new Error("Method 'getNodeType' is not implemented")
    }

    /**
     * Instructs the store to make the current graph state, or any pending modifications
     * (creations, updates, deletions of nodes and edges), durable according to its underlying
     * persistence mechanism. Implementations without an external backend may fulfill this
     * contract by performing no operation, updating an internal cache, or saving to a
     * temporary store. This method orchestrates the 'upstream' flow of 
     * data for long-term storage.
     */
    persistGraphState() {
        throw new Error("Method 'persistGraphState' is not implemented")
    }
}
