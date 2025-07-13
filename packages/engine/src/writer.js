import { GraphEditor } from ".";
/**
 * @typedef {Object} RelationshipRuleset
 * @property {string} source_column
 * @property {string} target_column
 * @property {import(".").EdgeType} edge_type
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
  init(graph, rules) {
    throw new Error("Method 'init' is not implemented")
  }

  write() {
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

  write() {
    const unique = new Set();
    for (const c_name of this.nodes_def) {
      for (const row of this.rows) {
        unique.add(row[c_name])
      }
    }
    for (const name of Array.from(unique)) {
      // this.graph?.createNode({
      //   type: "c4rdx1offhvxrtl",
      //   name,
      //   metadata: "",
      //   x: 100,
      //   y: 100,
      // })
    }
  }

  /**
   * @param {GraphEditor} graph
   * @param {RelationshipRuleset[]} rules 
   */
  init(graph, rules) {
    this.graph = graph;
    this.rules = rules;
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
