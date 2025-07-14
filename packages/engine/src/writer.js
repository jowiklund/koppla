import { assert_is_not_null } from "@kpla/assert";
import { GraphEditor } from ".";
/**
 * @typedef {Object} RelationshipRuleset
 * @property {string} source_column
 * @property {string} target_column
 * @property {import(".").EdgeTypeId} edge_type
 */

/**
 * @interface IWriter
 * @description Interface for generic writer that writes graph data to the engine
 */
export class IWriter {
  /**
   * @param {GraphEditor} graph
   * @param {RelationshipRuleset[]} rules 
   */
  write(graph, rules) {
    throw new Error("Method 'write' is not implemented")
  }
}

export class CSVWriter extends IWriter {
  /** @type {{[key: string]: any}[]} */
  rows = [];
  /** @type {Map<string, number>}*/
  key_index = new Map()
  /**
   * @param {string} data 
   * @param {string[]} nodes_def 
   */
  constructor(data, nodes_def) {
    super();
    this.nodes_def = nodes_def;
    const raw_data = this._CSVToArray(data);
    const index_key = new Map();
    for (const [index, row] of raw_data.entries()) {
      if (index === 0) {
        for (const [ i, k ] of row.entries()) {
          index_key.set(i, k);
          this.key_index.set(k, i);
        }
        continue;
      }

      const obj = {};
      for (const [i, val] of row.entries()) {
        Object.assign(obj, {[index_key.get(i)]: val.trim()})
      }
      this.rows.push(obj);
    }
  }

  /**
   * @param {GraphEditor} graph
   * @param {RelationshipRuleset[]} rules 
   */
  async write(graph, rules) {
    const unique = new Set();
    for (const c_name of this.nodes_def) {
      for (const row of this.rows) {
        unique.add(row[c_name])
      }
    }

    /** @type {import(".").EdgeBase[]} */
    const edges = [];
    for (const rule of rules) {
      for (const row of this.rows) {
        edges.push({
          type: rule.edge_type,
          start_id: row[rule.source_column],
          end_id: row[rule.target_column]
        })
      }
    }
    graph.store.map(Array.from(unique).map(u => ({
      name: u,
      id: u,
      type: "c4rdx1offhvxrtl",
      metadata: ""
    })), edges)
    // const names_handles = new Map()
    // for (const name of Array.from(unique)) {
    //   assert_is_not_null(graph)
    //   const handle = graph.createNode({
    //     type: "c4rdx1offhvxrtl",
    //     name,
    //     metadata: "",
    //     x: 100,
    //     y: 100,
    //   })
    //   names_handles.set(name, handle)
    // }
    // console.log(names_handles.entries())
    //
    // for (const rule of rules) {
    //   for (const row of this.rows) {
    //     const start_handle = names_handles.get(row[rule.source_column])
    //     const end_handle = names_handles.get(row[rule.target_column])
    //     assert_is_not_null(start_handle);
    //     assert_is_not_null(end_handle);
    //
    //     const start_node = graph.store.getNodeByHandle(start_handle)
    //     const end_node = graph.store.getNodeByHandle(end_handle)
    //     assert_is_not_null(start_node)
    //     assert_is_not_null(end_node)
    //
    //     graph.createEdge({
    //       start_id: start_node.id || "",
    //       end_id: end_node.id || "",
    //       type: rule.edge_type
    //     })
    //   }
    // }
  }

  /**
   * @param {string} str_data 
   */
  _CSVToArray(str_data){
    const str_delimiter = ",";
    var obj_pattern = new RegExp(
      (
        "(\\" + str_delimiter + "|\\r?\\n|\\r|^)" +
          "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
          "([^\"\\" + str_delimiter + "\\r\\n]*))"
      ),
      "gi"
    );

    /** @type {string[][]} */
    var arr_data = [[]];
    var arr_matches = null;

    while (arr_matches = obj_pattern.exec( str_data )){
      var strMatchedDelimiter = arr_matches[ 1 ];
      if (
        strMatchedDelimiter.length &&
          strMatchedDelimiter !== str_delimiter
      ){
        arr_data.push([]);
      }

      let str_matched_value = "";

      if (arr_matches[2]){
        str_matched_value = arr_matches[2].replace(
          new RegExp( "\"\"", "g" ),
          "\""
        );
      } else {
        str_matched_value = arr_matches[3];
      }
      arr_data[arr_data.length-1].push(str_matched_value);
    }
    return( arr_data );
  }
}
