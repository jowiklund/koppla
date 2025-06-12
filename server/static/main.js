/**
 * @typedef {Object} Coord
 * @property {number} x
 * @property {number} y
 */

async function run() {
  const canvas = document.getElementById("node-canvas");

  /** @type {CanvasRenderingContext2D} */
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.scale(dpr, dpr);

  try {
    const source = await fetch("main.wasm");
    const buffer = await source.arrayBuffer();
    const wasm = await WebAssembly.instantiate(buffer, {
      env: {
        print: (data) => {
          console.log(data);
        },
      },
    });
    const zig = wasm.instance.exports;

    const memory = zig.memory;

    zig.init();

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    const jsStringBufferPtr = zig.js_string_buffer.value;

    function writeZigString(str) {
      const encoded = textEncoder.encode(str);
      const buffer = new Uint8Array(memory.buffer, jsStringBufferPtr, 256);
      buffer.set(encoded);
      return encoded.length;
    }

    function readZigString(ptr, len) {
      const buffer = new Uint8Array(memory.buffer, ptr, len);
      return textDecoder.decode(buffer);
    }

    const ZoneType = {
      personal: zig.getZoneTypePersonal(),
      read_protected: zig.getZoneTypeReadProtected(),
      normal: zig.getZoneTypeNormal(),
    };
    const CoworkerAuth = {
      admin: zig.getCoworkerAuthAdmin(),
      manager: zig.getCoworkerAuthManager(),
      internal: zig.getCoworkerAuthInternal(),
      guest: zig.getCoworkerAuthGuest(),
    };

    const GraphObjectType = {
      coworker: 0,
      group: 1,
      zone: 2,
    };

    const NODE_RADIUS = 20;
    const GRID_SIZE = 20;

    let len = writeZigString("Software");
    zig.createZoneNode(
      snapToGrid(400),
      snapToGrid(350),
      len,
      ZoneType.read_protected,
    );

    len = writeZigString("Support");
    zig.createZoneNode(
      snapToGrid(400),
      snapToGrid(350),
      len,
      ZoneType.read_protected,
    );

    len = writeZigString("Protokoll");
    zig.createZoneNode(
      snapToGrid(400),
      snapToGrid(350),
      len,
      ZoneType.read_protected,
    );

    len = writeZigString("Josef");
    zig.createCoworkerNode(
      snapToGrid(150),
      snapToGrid(150),
      len,
      CoworkerAuth.admin,
    );

    len = writeZigString("Lelle Praktikant");
    zig.createCoworkerNode(
      snapToGrid(150),
      snapToGrid(150),
      len,
      CoworkerAuth.admin,
    );

    len = writeZigString("Pete Hegseth");
    zig.createCoworkerNode(
      snapToGrid(150),
      snapToGrid(150),
      len,
      CoworkerAuth.admin,
    );

    len = writeZigString("Jonas");
    zig.createCoworkerNode(
      snapToGrid(150),
      snapToGrid(150),
      len,
      CoworkerAuth.admin,
    );

    len = writeZigString("Christer");
    zig.createCoworkerNode(
      snapToGrid(130),
      snapToGrid(150),
      len,
      CoworkerAuth.admin,
    );

    len = writeZigString("Styrelse");
    zig.createGroupNode(snapToGrid(400), snapToGrid(150), len);

    len = writeZigString("Developers");
    zig.createGroupNode(snapToGrid(400), snapToGrid(150), len);

    function snapToGrid(value) {
      return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }

    let is_dragging = false;
    let dragged_node_handle = 0;
    let drag_offset_x = 0;
    let drag_offset_y = 0;

    let is_connecting = false;
    let connection_start_handle = 0;
    let current_mouse_x = 0;
    let current_mouse_y = 0;

    let selected_node_handle = 0;

    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      selected_node_handle = 0;

      const count = zig.getNodeCount();
      for (let i = count - 1; i >= 0; i--) {
        const handle = zig.getNodeHandleByIndex(i);
        const nodeX = zig.getNodeX(handle);
        const nodeY = zig.getNodeY(handle);

        const dx = mouseX - nodeX;
        const dy = mouseY - nodeY;

        if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) {
          selected_node_handle = handle;
          if (e.shiftKey) {
            is_connecting = true;
            connection_start_handle = handle;
          } else {
            is_dragging = true;
            dragged_node_handle = handle;
            drag_offset_x = dx;
            drag_offset_y = dy;
            canvas.style.cursor = "grabbing";
          }
          return;
        }
      }
    });

    window.addEventListener("keydown", (e) => {
      if (
        (e.key == "Delete" || e.key == "Backspace") &&
          selected_node_handle != 0
      ) {
        console.log(`Deleting node: ${selected_node_handle}`);
        zig.deleteNode(selected_node_handle);
        selected_node_handle = 0;
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      current_mouse_x = mouseX;
      current_mouse_y = mouseY;

      if (is_dragging) {
        const newX = snapToGrid(mouseX - drag_offset_x);
        const newY = snapToGrid(mouseY - drag_offset_y);
        zig.setNodePosition(dragged_node_handle, newX, newY);
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      if (is_connecting) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const count = zig.getNodeCount();
        for (let i = 0; i < count; i++) {
          const end_handle = zig.getNodeHandleByIndex(i);
          if (end_handle == connection_start_handle) continue;

          const nodeX = zig.getNodeX(end_handle);
          const nodeY = zig.getNodeY(end_handle);
          const dx = mouseX - nodeX;
          const dy = mouseY - nodeY;
          if (dx * dx + dy * dy < NODE_RADIUS * NODE_RADIUS) {
            zig.createEdge(connection_start_handle, end_handle);
            break;
          }
        }
      }
      is_dragging = false;
      is_connecting = false;
      dragged_node_handle = 0;
      canvas.style.cursor = "default";
    });

    function draw() {
      const logicalWidth = canvas.width / dpr;
      const logicalHeight = canvas.height / dpr;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      ctx.fillStyle = "#ebebeb";
      for (let x = GRID_SIZE; x < logicalWidth; x += GRID_SIZE) {
        for (let y = GRID_SIZE; y < logicalHeight; y += GRID_SIZE) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      const edge_count = zig.getEdgeCount();
      const edgeBundles = new Map();

      for (let i = 0; i < edge_count; i++) {
        const start_handle = zig.getEdgeStartNode(i);
        const end_handle = zig.getEdgeEndNode(i);

        const key = Math.min(start_handle, end_handle) + '-' + Math.max(start_handle, end_handle);

        if (!edgeBundles.has(key)) {
          edgeBundles.set(key, []);
        }
        edgeBundles.get(key).push({ start_handle, end_handle });
      }
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 2;

      edgeBundles.forEach(bundle => {
        const bundleSize = bundle.length;
        const initialOffset = -(bundleSize - 1) / 2.0;

        bundle.forEach((edge, index) => {
          const startNode = getNodeXY(edge.start_handle);
          const endNode = getNodeXY(edge.end_handle);

          const { startGate, endGate } = getBestGates(startNode, endNode);

          const startCoords = getGateCoordinates(startNode, startGate, NODE_RADIUS);
          const endCoords = getGateCoordinates(endNode, endGate, NODE_RADIUS);

          const offset = initialOffset + index;

          drawEdgeOrthogonal(ctx, startCoords, startGate, endCoords, endGate, offset);
        });
      });

      if (is_connecting) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;

        const startNode = getNodeXY(connection_start_handle);
        const mouseCoords = { x: current_mouse_x, y: current_mouse_y };
        const { startGate, endGate } = getBestGates(startNode, mouseCoords);
        const startCoords = getGateCoordinates(startNode, startGate, NODE_RADIUS);

        drawEdgeOrthogonal(
          ctx,
          startCoords,
          startGate,
          mouseCoords,
          endGate,
          0
        );

        ctx.setLineDash([]);
      }

      const node_count = zig.getNodeCount();

      for (let i = 0; i < node_count; i++) {
        const handle = zig.getNodeHandleByIndex(i);
        const x = zig.getNodeX(handle);
        const y = zig.getNodeY(handle);
        const type = zig.getGraphObjectType(handle);

        const name_ptr = zig.getNodeNamePtr(handle);
        const name_len = zig.getNodeNameLen(handle);
        const name = readZigString(name_ptr, name_len);

        ctx.beginPath();

        switch (type) {
          case GraphObjectType.coworker:
            ctx.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI);
            ctx.fillStyle = "#6699ff";
            break;
          case GraphObjectType.group:
            ctx.roundRect(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS*2, NODE_RADIUS*2, [5]);
            ctx.fillStyle = "#ff9966";
            break;
          case GraphObjectType.zone:
            ctx.roundRect(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS*2, NODE_RADIUS*2, [5]);
            ctx.fillStyle = "#66ff99";
            break;
        }

        ctx.fill();
        if (handle === selected_node_handle) {
          ctx.strokeStyle = "#089fff";
          ctx.lineWidth = 4;
        } else {
          ctx.strokeStyle = "#000"
          ctx.lineWidth = 2;
        }

        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.rect(x - (name.length / 2) * 8, y + NODE_RADIUS + 5, name.length * 8, 20);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(name, x, y + NODE_RADIUS + 10);
      }

      requestAnimationFrame(draw);
    }

    /**
     *
     * @returns {Coord}
     */
    function getNodeXY(handle) {
      return {
        x: zig.getNodeX(handle),
        y: zig.getNodeY(handle),
      };
    }

    draw();
  } catch (err) {
    console.error("Failed to load or run Wasm module:", err);
  }
}

const GATES = {
  TOP: 0,
  BOTTOM: 1,
  LEFT: 2,
  RIGHT: 3
};

/**
 * Determines the best exit and entry gates for a connection
 * based on the relative position of two nodes.
 * @param {{x: number, y: number}} startNode The start node's coordinates.
 * @param {{x: number, y: number}} endNode The end node's coordinates.
 * @returns {{startGate: string, endGate: string}}
 */
function getBestGates(startNode, endNode) {
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
            return { startGate: GATES.RIGHT, endGate: GATES.LEFT };
        } else {
            return { startGate: GATES.LEFT, endGate: GATES.RIGHT };
        }
    } else {
        if (dy > 0) {
            return { startGate: GATES.BOTTOM, endGate: GATES.TOP };
        } else {
            return { startGate: GATES.TOP, endGate: GATES.BOTTOM };
        }
    }
}

/**
 * @param {{x: number, y: number}} node The node's center coordinates.
 * @param {string} gate The gate (from GATES enum).
 * @param {number} radius The node's radius.
 * @returns {{x: number, y: number}}
 */
function getGateCoordinates(node, gate, radius) {
    switch (gate) {
        case GATES.TOP:    return { x: node.x, y: node.y - radius };
        case GATES.BOTTOM: return { x: node.x, y: node.y + radius };
        case GATES.LEFT:   return { x: node.x - radius, y: node.y };
        case GATES.RIGHT:  return { x: node.x + radius, y: node.y };
        default:           return node;
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx The canvas context.
 * @param {Coord} startCoords
 */
function drawEdgeOrthogonal(ctx, startCoords, startGate, endCoords, endGate, offset) {
    const cornerRadius = 10;
    const bundleGap = 10;
    const offsetAmount = offset * bundleGap;
    const sx = startCoords.x;
    const sy = startCoords.y;
    const ex = endCoords.x;
    const ey = endCoords.y;

    ctx.beginPath();
    ctx.moveTo(sx, sy);

    const isHorizontalStart = startGate === GATES.LEFT || startGate === GATES.RIGHT;
    const isHorizontalEnd = endGate === GATES.LEFT || endGate === GATES.RIGHT;

    if (isHorizontalStart && isHorizontalEnd) {
        const midX = sx + (ex - sx) / 2 + offsetAmount;
        ctx.arcTo(midX, sy, midX, ey, cornerRadius);
        ctx.arcTo(midX, ey, ex, ey, cornerRadius);
    } else if (!isHorizontalStart && !isHorizontalEnd) {
        const midY = sy + (ey - sy) / 2 + offsetAmount;
        ctx.arcTo(sx, midY, ex, midY, cornerRadius);
        ctx.arcTo(ex, midY, ex, ey, cornerRadius);
    } else {
        if (isHorizontalStart) {
            const elbowX = ex;
            const elbowY = sy;
            ctx.arcTo(elbowX, elbowY, ex, ey, cornerRadius);
        } else {
            const elbowX = sx;
            const elbowY = ey;
            ctx.arcTo(elbowX, elbowY, ex, ey, cornerRadius);
        }
    }

    ctx.lineTo(ex, ey);
    ctx.stroke();
}

run();
