const std = @import("std");

var memory_buffer: [16 * 1024 * 1024]u8 align(16) = undefined;
var fba: std.heap.FixedBufferAllocator = undefined;

pub export var js_string_buffer: [256]u8 = undefined;

const NodeHandle = usize;

pub const Node = struct {
    x: f32,
    y: f32,
    edges_incoming: std.ArrayList(NodeHandle),
    edges_outgoing: std.ArrayList(NodeHandle),
    mass: f32,
    is_fixed: bool,
    velocity_x: f32,
    velocity_y: f32
};

var node_list: std.ArrayList(*Node) = undefined;

export fn init() void {
    fba = std.heap.FixedBufferAllocator.init(&memory_buffer);
    node_list = std.ArrayList(*Node).init(fba.allocator());
}

export fn createNode(x: f32, y: f32) NodeHandle {
    const node = fba.allocator().create(Node) catch @panic("OOM: Node");
    node.* = .{
        .x = x,
        .y = y,
        .edges_incoming = std.ArrayList(NodeHandle).init(fba.allocator()),
        .edges_outgoing = std.ArrayList(NodeHandle).init(fba.allocator()),
        .mass = 1.0,
        .is_fixed = false,
        .velocity_x = 0.0,
        .velocity_y = 0.0,
    };

    node_list.append(node) catch @panic("OOM: Node list");
    return @intFromPtr(node);
}

fn copyName(name_buffer: *[32]u8, name_len: usize) void {
    const len = @min(name_len, name_buffer.len);
    @memcpy(name_buffer[0..len], js_string_buffer[0..len]);
    if (len < name_buffer.len) {
        @memset(name_buffer[len..], 0);
    }
}

export fn createEdge(start_handle: usize, end_handle: usize) void {
    const start_node: *Node = @ptrFromInt(start_handle);
    const end_node: *Node = @ptrFromInt(end_handle);
    start_node.edges_outgoing.append(end_handle) catch @panic("OOM: Node outgoing");
    end_node.edges_incoming.append(start_handle) catch @panic("OOM: Node incoming");
}

export fn deleteNode(handle: usize) void {
    const node_to_delete: *Node = @ptrFromInt(handle);
    var index_in_main_list: ?usize = null;

    for (node_list.items, 0..) |ptr, i| {
        if (@intFromPtr(ptr) == handle) {
            index_in_main_list = i;
            break;
        }
    }

    if (index_in_main_list == null) return;

    for (node_to_delete.edges_outgoing.items) |neighbor_handle| {
        const neighbor_node: *Node = @ptrFromInt(neighbor_handle);
        var k: usize = 0;
        while (k < neighbor_node.edges_incoming.items.len) {
            if (neighbor_node.edges_incoming.items[k] == handle) {
                _ = neighbor_node.edges_incoming.swapRemove(k);
                break; 
            }
            k += 1;
        }
    }

    for (node_to_delete.edges_incoming.items) |neighbor_handle| {
        const neighbor_node: *Node = @ptrFromInt(neighbor_handle);
        var k: usize = 0;
        while (k < neighbor_node.edges_outgoing.items.len) {
            if (neighbor_node.edges_outgoing.items[k] == handle) {
                _ = neighbor_node.edges_outgoing.swapRemove(k);
                break;
            }
            k += 1;
        }
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

export fn getNodeOutgoingHandleByIndex(handle: NodeHandle, index: usize) usize {
    const node: *Node = @ptrFromInt(handle);
    const node_ptr = node.edges_outgoing.items[index];
    return node_ptr;
}

export fn getNodeIncomingHandleByIndex(handle: NodeHandle, index: usize) usize {
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
