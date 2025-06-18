<div align="center">
    <h2>
      <picture>
          <source media="(prefers-color-scheme: dark)" srcset="assets/koppla-logo.png">
          <img alt="Koppla logo" src="assets/koppla-logo-light.png" width="250">
        </picture>
    </h2>
</div>

<p align="center">k'ɔpːla</p>
<h4 align="center">Connect everything</h4>

# \* WORK IN PROGRESS - NOTHING IS FINALIZED \* #

Koppla is a set of powerful, independent JavaScript modules designed to work together or separately. At its core is a high-performance graph engine powered by WebAssembly, but its components can be used to create everything from a full-featured graph editor to a simple, reactive web page.

### Core Philosophy: A Modular Toolkit
Koppla is not a monolithic framework. It's a collection of packages that you can pick and choose from based on your needs.
- `@koppla/engine`: The core graph logic. A high-performance WebAssembly engine wrapped in a clean GraphEditor API. Use this for backend graph processing or building a completely custom frontend (e.g., with React, Svelte, or Three.js).
- `@koppla/canvas-driver`: A pre-built, high-performance canvas renderer. It provides the interactive graph editor experience out of the box and depends on `@koppla/engine` and `@koppla/signals`.
- `@koppla/signals`: A standalone, zero-dependency library for creating reactive UIs. It includes createSignal and createEffect primitives and a lightweight HTML template parser. Use this in any project where you need simple reactivity without a large framework.

### Getting Started: 
#### The Full Graph Editor
This is the fastest way to get a complete, interactive graph editor running. This approach uses all the modules together.

<picture>
    <img alt="Graph" src="assets/graph.png">
</picture>

1. Installation
`npm install @koppla/engine @koppla/canvas-driver`
2. HTML Setup
    - Create the necessary DOM elements for the editor to attach to.
``` html
<!DOCTYPE html>
<html>
<head>
  <title>Koppla Editor</title>
  <link rel="stylesheet" href="style.css"> <!-- Add your own styles -->
</head>
<body>

  <div id="control-panel">
    <!-- Draggable nodes will be added here by the driver -->
  </div>

  <div id="canvas-container">
    <!-- The multi-layered canvas will be created here -->
  </div>

  <dialog id="edge-creation-dialog">
    <!-- Your form for creating edges -->
  </dialog>

  <script type="module" src="main.js"></script>
</body>
</html>
```
3. JavaScript Initialization
    - In your main.js, import and initialize the CanvasGUIDriver.

``` javascript
import { CanvasGUIDriver } from '@koppla/canvas-driver';

// 1. Define your node and edge types
const nodeTypes = [/* ... your node type definitions ... */];
const edgeTypes = [/* ... your edge type definitions ... */];

// 2. Define the initial graph data
const initialGraphData = [/* ... your initial nodes ... */];

// 3. Configure and run the driver
const driver = new CanvasGUIDriver({
  container_id: 'canvas-container',
  control_panel_id: 'control-panel',
  edge_dialog_id: 'edge-creation-dialog'
});

driver.run(
  { node_types: nodeTypes, edge_types: edgeTypes },
  initialGraphData
);
```

### Usage Guides
1. Using Only the Graph Engine (`@koppla/engine`)
Use Case: When you need a powerful in-memory graph data structure but want to build your own UI or use it on a server with Node.js.

- Installation: `npm install @koppla/engine`

#### Example:
- This example shows how to use the engine programmatically without any UI.
```javascript
import { getEngine } from '@koppla/engine';

async function main() {
  // Get the WASM engine instance
  const graph = await getEngine();

  // Define node and edge types
  graph.setNodeType({ id: 0, name: 'User', ... });
  graph.setEdgeType({ id: 0, name: 'Connects', ... });

  // Create nodes
  const nodeA = graph.createNode({ type: 0, name: 'Node A' }, 10, 10);
  const nodeB = graph.createNode({ type: 0, name: 'Node B' }, 100, 100);

  // Create an edge
  graph.createEdge(nodeA, nodeB, 0);

  // Query the graph
  const allNodes = graph.getNodes();
  console.log(`Graph contains ${allNodes.length} nodes.`);

  // Listen for changes
  graph.on('node:create', ({ handle }) => {
    console.log(`Node with handle ${handle} was created.`);
  });
}

main();
```
2. Using the Signals & Document Parser (`@koppla/signals`)
- Use Case: When you need an extremely lightweight, zero-dependency alternative to larger frameworks for adding simple reactivity to your HTML.
- Installation: `npm install @koppla/signals`

#### Example:
``` html
<div id="app">
  <input id="name-input" type="text">
  <h1>Hello, {{name}}!</h1>

  <ul>
    <template koppla-for="$item in items">
      <li>{{$item.text}}</li>
    </template>
  </ul>
</div>
```
JavaScript:
``` javascript
import { createSignal, createEffect, DocumentParser } from '@koppla/signals';

// 1. Initialize the parser on your root element
const parser = new DocumentParser(document.getElementById('app'));

// 2. Create signals by name. The parser will find and connect them.
const [getName, setName] = parser.getOrCreateSignal('name', 'World');
const [getItems, setItems] = parser.getOrCreateSignal('items', []);

// 3. Bind the input to the 'name' signal
document.getElementById('name-input').addEventListener('input', (e) => {
  setName(e.target.value);
});

// 4. Run the parser to make the template reactive
parser.parse();

// 5. Now, any updates to the signals will automatically update the DOM
setTimeout(() => {
  setItems([
    { text: 'First item' },
    { text: 'Second item' }
  ]);
}, 1000);
```

### API Reference (Overview)
- `@koppla/engine`
    - `getEngine(): Promise<GraphEditor>`: Asynchronously loads the WASM module and returns a GraphEditor instance.
    - `GraphEditor`: The main class for interacting with the graph.
        - `.createNode(data, x, y)`
        - `.createEdge(startHandle, endHandle, type)`
        - `.deleteNode(handle)
        - `.getNodes() / .getEdges()`
        - `.getRelations()`: Returns a list of relationships represented with you metadata. Use this to persist whatever data you want to derive from the connections made.
        - `.on(eventName, callback)`: Listen for events like node:create, world:update, etc.
- `@koppla/canvas-driver`
    - `CanvasGUIDriver`: The main class for the UI.
        - `constructor(options)`: Takes an options object with DOM element IDs.
        - `.run(config, initialData)`: Starts the editor.
- `@koppla/signals`
    - `createSignal(initialValue)`: Creates a reactive state primitive. Returns a [getter, setter] tuple.
    - `createEffect(fn)`: Creates a function that re-runs whenever a signal it uses is updated.
    - `DocumentParser`: Binds signals to your HTML.
        - `.getOrCreateSignal(name, initialValue)`
        - `.parse()`: Scans the DOM and activates reactive bindings.

### License
This project is licensed under the MIT License. See the LICENSE file for details.
