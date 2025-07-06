import { GraphEditor } from ".";

/**
 * @interface IGraphStore
 * @description Interface for generic graph data storage
 */
export class IGraphStore {
    /**
     * Initializes the store, loading types, nodes, and edges from the backend
     * and populating the WASM graph editor.
     * @param {GraphEditor} graph_editor
     */
    async init(graph_editor) {
        throw new Error("Method 'init' is not implemented");
    }

    /**
     * Stores or updates a node's full data (including WASM-derived properties).
     * If `node.id` is undefined, the store should assign a temporary ID and
     * queue it for creation. Otherwise, it queues for update.
     * This method primarily updates the local cache and queues changes for batch persistence.
     * @param {import(".").NodeHandle} node_handle - The WASM handle of the node.
     * @param {import(".").NodeBase} node_data - The complete node data, including its ID (if known) and WASM properties.
     */
    async setNode(node_handle, node_data) {
        throw new Error("Method 'setNode' is not implemented");
    }

    /**
     * Retrieves the complete node data by its WASM handle from the store's cache.
     * @param {import(".").NodeHandle} node_handle
     * @returns {import(".").Node | undefined}
     */
    getNodeByHandle(node_handle) {
        throw new Error("Method 'getNodeByHandle' is not implemented");
    }

    /**
     * Retrieves the complete node data by its foreign ID from the store's cache.
     * This method is useful for correlating data using database IDs.
     * @param {string} node_id
     * @returns {import(".").Node | undefined}
     */
    getNodeById(node_id) {
        throw new Error("Method 'getNodeById' is not implemented");
    }

    /**
     * Retrieves the WASM handle for a node given its foreign ID.
     * @param {string} node_id
     * @returns {import(".").NodeHandle | undefined}
     */
    getNodeHandleById(node_id) {
        throw new Error("Method 'getHandleById' is not implemented");
    }

    /**
     * Deletes a node from the store's cache and queues it for deletion from the backend.
     * @param {import(".").NodeHandle} node_handle
     */
    deleteNode(node_handle) {
        throw new Error("Method 'deleteNode' is not implemented");
    }

    /**
     * Stores or updates an edge's full data (including WASM-derived properties).
     * If `edge.id` is undefined, the store should assign a temporary ID and
     * queue it for creation. Otherwise, it queues for update.
     * This method primarily updates the local cache and queues changes for batch persistence.
     * @param {import(".").EdgeHandle} edge_handle - The WASM handle of the edge.
     * @param {import(".").Edge} edge_data - The complete edge data, including its ID (if known) and WASM properties.
     */
    async setEdge(edge_handle, edge_data) {
        throw new Error("Method 'setEdge' is not implemented");
    }

    /**
     * Retrieves the complete edge data by its WASM handle from the store's cache.
     * @param {import(".").EdgeHandle} edge_handle
     * @returns {import(".").Edge | undefined}
     */
    getEdgeByHandle(edge_handle) {
        throw new Error("Method 'getEdgeByHandle' is not implemented");
    }

    /**
     * Retrieves the complete edge data by its foreign ID from the store's cache.
     * @param {string} edge_id
     * @returns {import(".").Edge | undefined}
     */
    getEdgeById(edge_id) {
        throw new Error("Method 'getEdgeById' is not implemented");
    }

    /**
     * Retrieves the WASM handle for an edge given its foreign ID.
     * @param {string} edge_id
     * @returns {import(".").EdgeHandle | undefined}
     */
    getEdgeHandleById(edge_id) {
        throw new Error("Method 'getEdgeHandleById' is not implemented");
    }

    /**
     * Deletes an edge from the store's cache and queues it for deletion from the backend.
     * @param {import(".").EdgeHandle} edge_handle
     */
    deleteEdge(edge_handle) {
        throw new Error("Method 'deleteEdge' is not implemented");
    }

    /**
     * Retrieves a node type definition.
     * @param {import(".").NodeTypeId} id
     * @returns {import(".").NodeType | undefined}
     */
    getNodeType(id) {
        throw new Error("Method 'getNodeType' is not implemented");
    }

    /**
     * Retrieves an edge type definition.
     * @returns {import(".").NodeType[]}
     */
    getNodeTypes() {
        // Corrected method name from original, assuming intended 'getEdgeType'
        throw new Error("Method 'getNodeTypes' is not implemented");
    }

    /**
     * Retrieves an edge type definition.
     * @param {import(".").EdgeTypeId} id
     * @returns {import(".").EdgeType | undefined}
     */
    getEdgeType(id) {
        // Corrected method name from original, assuming intended 'getEdgeType'
        throw new Error("Method 'getEdgeType' is not implemented");
    }

    /**
     * Retrieves an edge type definition.
     * @returns {import(".").EdgeType[]}
     */
    getEdgeTypes() {
        // Corrected method name from original, assuming intended 'getEdgeType'
        throw new Error("Method 'getEdgeTypes' is not implemented");
    }

    /**
     * Instructs the store to trigger a persistence cycle, sending any pending modifications
     * (creations, updates, deletions of nodes and edges) to the backend.
     * This method typically initiates a throttled or debounced operation.
     */
    persistGraphState() {
        throw new Error("Method 'persistGraphState' is not implemented");
    }

    /**
     * Generates a temporary client-side ID for new nodes or edges that haven't been
     * persisted to the backend yet. Implementations should ensure uniqueness.
     * @returns {string} A unique temporary ID.
     */
    generateTempId() {
        throw new Error("Method 'generateTempId' is not implemented");
    }
}
