const std = @import("std");

var memory_buffer: [16 * 1024 * 1024]u8 align(16) = undefined;
var fba: std.heap.FixedBufferAllocator = undefined;

pub export var js_string_buffer: [256]u8 = undefined;

const NodeHandle = usize;
const EdgeHandle = usize;
const EdgeType = u8;

pub const Edge = struct {
    start_node: NodeHandle,
    end_node: NodeHandle,
    type: EdgeType
};

pub const Node = struct {
    x: f32,
    y: f32,
    edges_incoming: std.ArrayList(EdgeHandle),
    edges_outgoing: std.ArrayList(EdgeHandle),
    mass: f32,
    is_fixed: bool,
    velocity_x: f32,
    velocity_y: f32
};

var node_list: std.ArrayList(*Node) = undefined;
var edge_list: std.ArrayList(*Edge) = undefined;

export fn init() void {
    fba = std.heap.FixedBufferAllocator.init(&memory_buffer);
    node_list = std.ArrayList(*Node).init(fba.allocator());
    edge_list = std.ArrayList(*Edge).init(fba.allocator());
}

export fn createNode(x: f32, y: f32) NodeHandle {
    const node = fba.allocator().create(Node) catch @panic("OOM: Node");
    node.* = .{
        .x = x,
        .y = y,
        .edges_incoming = std.ArrayList(EdgeHandle).init(fba.allocator()),
        .edges_outgoing = std.ArrayList(EdgeHandle).init(fba.allocator()),
        .mass = 1.0,
        .is_fixed = false,
        .velocity_x = 0.0,
        .velocity_y = 0.0,
    };

    node_list.append(node) catch @panic("OOM: Node list");
    return @intFromPtr(node);
}

export fn createEdge(start_handle: usize, end_handle: usize, edge_type: EdgeType) void {
    const edge = fba.allocator().create(Edge) catch @panic("OOM: Edge");
    edge.* = .{
        .type = edge_type,
        .start_node = start_handle,
        .end_node = end_handle
    };

    edge_list.append(edge) catch @panic("OOM: Edge list");

    const start_node: *Node = @ptrFromInt(start_handle);
    const end_node: *Node = @ptrFromInt(end_handle);

    start_node.edges_outgoing.append(@intFromPtr(edge)) catch @panic("OOM: Node outgoing");
    end_node.edges_incoming.append(@intFromPtr(edge)) catch @panic("OOM: Node incoming");
}

export fn getEdgeHandleByIndex(index: usize) EdgeHandle {
    const edge_ptr = edge_list.items[index];
    return @intFromPtr(edge_ptr);
}

export fn getEdgeCount() usize {
    return edge_list.items.len;
}

export fn getEdgeStartNodeHandle(handle: EdgeHandle) NodeHandle {
    const edge_ptr: *Edge = @ptrFromInt(handle);
    return edge_ptr.start_node;
}

export fn getEdgeEndNodeHandle(handle: EdgeHandle) EdgeHandle {
    const edge_ptr: *Edge = @ptrFromInt(handle);
    return edge_ptr.end_node;
} 

export fn getEdgeType(handle: EdgeHandle) EdgeType {
    const edge_ptr: *Edge = @ptrFromInt(handle);
    return edge_ptr.type;
}

export fn deleteEdge(handle: EdgeHandle) void {
    const edge_to_delete: *Edge = @ptrFromInt(handle);
    var index_in_edge_list: ?usize = null;

    for (edge_list.items, 0..) |ptr, i| {
        if (@intFromPtr(ptr) == handle) {
            index_in_edge_list = i;
            break;
        }
    }

    if (index_in_edge_list == null) return;

    const edge_start_node: *Node = @ptrFromInt(edge_to_delete.start_node);
    const edge_end_node: *Node = @ptrFromInt(edge_to_delete.end_node);

    for (edge_start_node.edges_outgoing.items, 0..) |outgoing_handle, i| {
        if (outgoing_handle == handle) {
            _ = edge_start_node.edges_outgoing.swapRemove(i);
            break;
        }
    }
    for (edge_end_node.edges_incoming.items, 0..) |outgoing_handle, i| {
        if (outgoing_handle == handle) {
            _ = edge_start_node.edges_outgoing.swapRemove(i);
            break;
        }
    }

    _ = edge_list.swapRemove(index_in_edge_list.?);

}

export fn deleteNode(handle: NodeHandle) void {
    const node_to_delete: *Node = @ptrFromInt(handle);
    var index_in_main_list: ?usize = null;

    for (node_list.items, 0..) |ptr, i| {
        if (@intFromPtr(ptr) == handle) {
            index_in_main_list = i;
            break;
        }
    }

    if (index_in_main_list == null) return;

    for (node_to_delete.edges_outgoing.items) |edge_handle| {
        deleteEdge(edge_handle);
    }

    for (node_to_delete.edges_incoming.items) |edge_handle| {
        deleteEdge(edge_handle);
    }

    node_to_delete.edges_incoming.deinit();
    node_to_delete.edges_outgoing.deinit();
    fba.allocator().destroy(node_to_delete);

    _ = node_list.swapRemove(index_in_main_list.?);
}

export fn getNodeX(handle: usize) f32 {
    const node_ptr: *const Node = @ptrFromInt(handle);
    return node_ptr.x;
}

export fn getNodeY(handle: usize) f32 {
    const node_ptr: *const Node = @ptrFromInt(handle);
    return node_ptr.y;
}

export fn setNodePosition(handle: NodeHandle, new_x: f32, new_y: f32) void {
    const node_ptr: *Node = @ptrFromInt(handle);
    node_ptr.x = new_x;
    node_ptr.y = new_y;
}

export fn getNodeCount() usize {
    return node_list.items.len;
}

export fn getNodeHandleByIndex(index: usize) usize {
    const node_ptr = node_list.items[index];
    return @intFromPtr(node_ptr);
}

export fn getNodeOutgoingHandleByIndex(handle: NodeHandle, index: usize) EdgeHandle {
    const node: *Node = @ptrFromInt(handle);
    const node_ptr = node.edges_outgoing.items[index];
    return node_ptr;
}

export fn getNodeIncomingHandleByIndex(handle: NodeHandle, index: usize) EdgeHandle {
    const node: *Node = @ptrFromInt(handle);
    const node_ptr = node.edges_incoming.items[index];
    return node_ptr;
}

export fn getNodeOutgoingCount(handle: NodeHandle) usize {
    const node: *Node = @ptrFromInt(handle);
    return node.edges_outgoing.items.len;
}

export fn getNodeIncomingCount(handle: NodeHandle) usize {
    const node: *Node = @ptrFromInt(handle);
    return node.edges_incoming.items.len;
}

extern fn print(usize) void;
