import { IWriter } from "@kpla/engine";

export class CSVWriter extends IWriter {
    /** @type {{[key: string]: any}[]} */
    rows = [];
    /** @type {Map<string, number>}*/
    key_index = new Map()
    /**
   * @param {string} data 
   * @param {NodeDefinition[]} nodes_def 
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
            for (let [i, val] of row.entries()) {
                val = val.trim();
                if (val.includes(";")) {
                    val = val.split(";");
                }
                Object.assign(obj, {[index_key.get(i)]: val})
            }
            this.rows.push(obj);
        }
    }

    /**
   * @param {GraphEditor} graph
   * @param {import("@kpla/engine/dist/writer.js").RelationshipRuleset[]} rules 
   */
    async write(graph, rules) {
        /** @type {Map<string, import("./PBStore.js").SparseNode>} */
        const unique = new Map();
        for (const node_def of this.nodes_def) {
            for (const row of this.rows) {
                if (!(node_def.column_id in row)) {
                    console.warn(`Column ${node_def.column_id} was not found in dataset`)
                    continue;
                }
                if (!(node_def.column_name in row)) {
                    console.warn(`Column ${node_def.column_name} was not found in dataset`)
                    continue;
                }
                const id = row[node_def.column_id];
                const name = row[node_def.column_name];
                const type = node_def.node_type;
                const key = `${id}-${name}-${type}`
                unique.set(key, {
                    name,
                    id,
                    type,
                    metadata: ""
                })
            }
        }

        /** @type {import("@kpla/engine").EdgeBase[]} */
        const edges = [];
        for (const rule of rules) {
            for (const row of this.rows) {
                const source_value = row[rule.source_column];
                const target_value = row[rule.target_column];
                let edge_type = "";
                if (rule.edge_type instanceof Map) {
                    const type_column = Array.from(rule.edge_type.keys())[0].split(":")[0];
                    const type_key = `${type_column}:${row[type_column]}`;
                    edge_type = rule.edge_type.get(type_key);
                    if (!edge_type) {
                        console.warn(`No edge type for ${type_key}`)
                        continue;
                    }
                }
                if (typeof rule.edge_type == "string") {
                    edge_type = rule.edge_type;
                }
                if (Array.isArray(target_value)) {
                    for (const target of target_value) {
                        edges.push({
                            type: edge_type,
                            start_id: source_value,
                            end_id: target
                        })
                    }
                    continue;
                }
                edges.push({
                    type: edge_type,
                    start_id: source_value,
                    end_id: target_value
                })
            }
        }
        return graph.store.map(Array.from(unique.values()), edges)
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

