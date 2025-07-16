import { GraphEditor } from ".";
/**
 * @typedef {Object} RelationshipRuleset
 * @property {string} source_column
 * @property {string} target_column
 * @property {Map<string, import(".").EdgeTypeId>} edge_type
 */

/**
 * @typedef {Object} NodeDefinition
 * @property {string} column_name
 * @property {string} column_id
 * @property {import(".").NodeTypeId} node_type
 */

/**
 * @interface IWriter
 * @description Interface for generic writer that writes graph data to the engine
 */
export class IWriter {
  /**
   * @param {GraphEditor} graph
   * @param {RelationshipRuleset[]} rules 
   * @returns {Promise<void>}
   */
  async write(graph, rules) {
    throw new Error("Method 'write' is not implemented")
  }
}
