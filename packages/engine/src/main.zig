const std = @import("std");

var memory_buffer: [16 * 1024 * 1024]u8 align(16) = undefined;
var fba: std.heap.FixedBufferAllocator = undefined;

pub export var js_string_buffer: [256]u8 = undefined;

const NodeHandle = usize;
const EdgeHandle = usize;

export fn alloc(size: usize) usize {
    const ptr = (fba.allocator().alloc(u8, size) catch @panic("OOM: js alloc")).ptr;
    return @intFromPtr(ptr);
}

export fn free(ptr: usize, len: usize) void {
    const typed_raw_array_ptr: [*]u8 = @ptrFromInt(ptr);
    const slice_to_free: []u8 = typed_raw_array_ptr[0..len];
    fba.allocator().free(slice_to_free);
}

pub const Edge = struct {
    start_node: NodeHandle,
    end_node: NodeHandle,
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

var grid_size: f32 = 0.1;

export fn init(gz: f32) void {
    grid_size = gz;
    fba = std.heap.FixedBufferAllocator.init(&memory_buffer);
    node_list = std.ArrayList(*Node).init(fba.allocator());
    edge_list = std.ArrayList(*Edge).init(fba.allocator());
}

fn snapToGrid(val: f32) f32 {
    return std.math.round(val / grid_size) * grid_size;
}

export fn createNode(x: f32, y: f32) NodeHandle {
    const node = fba.allocator().create(Node) catch @panic("OOM: Node");
    node.* = .{
        .x = snapToGrid(x),
        .y = snapToGrid(y),
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

export fn createEdge(start_handle: usize, end_handle: usize) EdgeHandle {
    const edge = fba.allocator().create(Edge) catch @panic("OOM: Edge");
    edge.* = .{
        .start_node = start_handle,
        .end_node = end_handle
    };

    edge_list.append(edge) catch @panic("OOM: Edge list");

    const start_node: *Node = @ptrFromInt(start_handle);
    const end_node: *Node = @ptrFromInt(end_handle);

    start_node.edges_outgoing.append(@intFromPtr(edge)) catch @panic("OOM: Node outgoing");
    end_node.edges_incoming.append(@intFromPtr(edge)) catch @panic("OOM: Node incoming");
    return @intFromPtr(edge);
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
    node_ptr.x = snapToGrid(new_x);
    node_ptr.y = snapToGrid(new_y);
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

const NodeForce = struct {
    fx: f32,
    fy: f32,
};

export fn alignHoriz(
    node_handles_ptr: [*]const NodeHandle,
    node_handles_len: usize,
) void {
    var node_ys = std.ArrayList(f32).init(fba.allocator());
    defer node_ys.deinit();

    for (0..node_handles_len) |i| {
        const handle = node_handles_ptr[i];
        const node: *Node = @ptrFromInt(handle);

        node_ys.append(node.y) catch @panic("OOM: align ys append");
    }

    var sum: f32 = 0.0;
    for (node_ys.items) |y| {
        sum += y;
    }

    const len: f32 = @floatFromInt(node_handles_len);
    const my: f32 = snapToGrid(sum / len);

    for (0..node_handles_len) |i| {
        const handle = node_handles_ptr[i];
        const node: *Node = @ptrFromInt(handle);

        node.y = my;
    }
}

export fn alignVert(
    node_handles_ptr: [*]const NodeHandle,
    node_handles_len: usize,
) void {
    var node_xs = std.ArrayList(f32).init(fba.allocator());
    defer node_xs.deinit();

    for (0..node_handles_len) |i| {
        const handle = node_handles_ptr[i];
        const node: *Node = @ptrFromInt(handle);

        node_xs.append(node.x) catch @panic("OOM: align ys append");
    }

    var sum: f32 = 0.0;
    for (node_xs.items) |y| {
        sum += y;
    }

    const len: f32 = @floatFromInt(node_handles_len);
    const mx: f32 = snapToGrid(sum / len);

    for (0..node_handles_len) |i| {
        const handle = node_handles_ptr[i];
        const node: *Node = @ptrFromInt(handle);

        node.x = mx;
    }
}

export fn evenHoriz(
    node_handles_ptr: [*]const NodeHandle,
    node_handles_len: usize,
) void {
    if (node_handles_len == 0) {
        return;
    }
    if (node_handles_len == 1) {
        return;
    }

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const temp_allocator = gpa.allocator();

    const sorted_handles = temp_allocator
        .dupe(NodeHandle, node_handles_ptr[0..node_handles_len])
        catch @panic("OOM: sort handles");

    defer temp_allocator.free(sorted_handles);

    std.sort.heap(usize, sorted_handles, {}, struct {
        fn compare(_: void, h1: NodeHandle, h2: NodeHandle) bool {
            const node1: *Node = @ptrFromInt(h1);
            const node2: *Node = @ptrFromInt(h2);
            return node1.x < node2.x;
        }
    }.compare);


    var big: f32 = 0.0;
    var small: f32 = std.math.floatMax(f32);

    for (0..node_handles_len) |i| {
        const handle = node_handles_ptr[i];
        const node: *Node = @ptrFromInt(handle);

        if (node.x > big) big = node.x;
        if (node.x < small) small = node.x;
    }

    const dx = big - small;
    const len_f32: f32 = @floatFromInt(node_handles_len);

    const spacing: f32 = if (node_handles_len > 1) dx / (len_f32 - 1.0) else 0.0;

    for (0..node_handles_len) |i| {
        const handle = sorted_handles[i];
        const node: *Node = @ptrFromInt(handle);

        const i_f: f32 = @floatFromInt(i);
        const target_x = small + (spacing * i_f);
        const rnd_down: f32 = target_x - @mod(target_x, grid_size);

        node.x = snapToGrid(rnd_down);
    }
}

export fn evenVert(
    node_handles_ptr: [*]const NodeHandle,
    node_handles_len: usize,
) void {
    if (node_handles_len == 0) {
        return;
    }
    if (node_handles_len == 1) {
        return;
    }

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const temp_allocator = gpa.allocator();

    const sorted_handles = temp_allocator
        .dupe(NodeHandle, node_handles_ptr[0..node_handles_len])
        catch @panic("OOM: sort handles");

    defer temp_allocator.free(sorted_handles);

    std.sort.heap(usize, sorted_handles, {}, struct {
        fn compare(_: void, h1: NodeHandle, h2: NodeHandle) bool {
            const node1: *Node = @ptrFromInt(h1);
            const node2: *Node = @ptrFromInt(h2);
            return node1.y < node2.y;
        }
    }.compare);


    var big: f32 = 0.0;
    var small: f32 = std.math.floatMax(f32);

    for (0..node_handles_len) |i| {
        const handle = node_handles_ptr[i];
        const node: *Node = @ptrFromInt(handle);

        if (node.y > big) big = node.y;
        if (node.y < small) small = node.y;
    }

    const dx = big - small;
    const len_f32: f32 = @floatFromInt(node_handles_len);

    const spacing: f32 = if (node_handles_len > 1) dx / (len_f32 - 1.0) else 0.0;

    for (0..node_handles_len) |i| {
        const handle = sorted_handles[i];
        const node: *Node = @ptrFromInt(handle);

        const i_f: f32 = @floatFromInt(i);
        const target_y = small + (spacing * i_f);
        const rnd_down: f32 = target_y - @mod(target_y, grid_size);

        node.y = snapToGrid(rnd_down);
    }
}

pub fn Queue(comptime Child: type) type {
    return struct {
        const Self = @This();
        const QNode = struct {
            data: Child,
            next: ?*QNode,
        };
        gpa: std.mem.Allocator,
        start: ?*QNode,
        end: ?*QNode,

        pub fn init(gpa: std.mem.Allocator) Self {
            return Self{
                .gpa = gpa,
                .start = null,
                .end = null,
            };
        }
        pub fn enqueue(self: *Self, value: Child) !void {
            const node = try self.gpa.create(QNode);
            node.* = .{ .data = value, .next = null };
            if (self.end) |end| end.next = node //
            else self.start = node;
            self.end = node;
        }
        pub fn dequeue(self: *Self) ?Child {
            const start = self.start orelse return null;
            defer self.gpa.destroy(start);
            if (start.next) |next|
                self.start = next
            else {
                self.start = null;
                self.end = null;
            }
            return start.data;
        }
    };
}

export fn sortNodes(
    iterations: usize,
    k_attraction: f32,
    k_repulsion: f32,
    optimal_dist: f32,
    damping_factor: f32
) void {
    if (node_list.items.len == 0) {
        return;
    }

    var node_forces = std.ArrayList(NodeForce).init(fba.allocator());
    defer node_forces.deinit();

    node_forces.ensureTotalCapacity(node_list.items.len) catch @panic("OOM: node_forces cap");

    for (0..node_list.items.len) |_| {
        node_forces.append(.{
            .fx = 0.0,
            .fy = 0.0
        }) catch @panic("OOM: node_forces append");
    }

    for (0..iterations) |_| {
        for (node_forces.items) |*force_item| {
            force_item.fx = 0.0;
            force_item.fy = 0.0;
        }

        for (node_list.items, 0..) |node1_ptr, i| {
            for (node_list.items, 0..) |node2_ptr, j| {
                if (i == j) continue;

                const dx = node1_ptr.x - node2_ptr.x;
                const dy = node1_ptr.y - node2_ptr.y;
                const dist_sq = dx * dx + dy * dy;

                const min_dist_sq = 0.01;
                const dist = std.math.sqrt(dist_sq + min_dist_sq);

                const force_magnitude = k_repulsion / dist_sq;

                const unit_dx = dx / dist;
                const unit_dy = dy / dist;

                const fx = force_magnitude * unit_dx;
                const fy = force_magnitude * unit_dy;

                node_forces.items[i].fx += fx;
                node_forces.items[i].fy += fy;
            }
        }

        for (edge_list.items) |edge_ptr| {
            const start_node_ptr: *Node = @ptrFromInt(edge_ptr.start_node);
            const end_node_ptr: *Node = @ptrFromInt(edge_ptr.end_node);

            var start_node_idx: ?usize = null;
            for (node_list.items, 0..) |node_ptr, k| {
                if (@intFromPtr(node_ptr) == @intFromPtr(start_node_ptr)) {
                    start_node_idx = k;
                    break;
                }
            }

            var end_node_idx: ?usize = null;
            for (node_list.items, 0..) |node_ptr, k| {
                if (@intFromPtr(node_ptr) == @intFromPtr(end_node_ptr)) {
                    end_node_idx = k;
                    break;
                }
            }

            if (start_node_idx == null or end_node_idx == null) {
                continue;
            }

            const dx = start_node_ptr.x - end_node_ptr.x;
            const dy = start_node_ptr.y - end_node_ptr.y;
            const dist_sq = dx*dx + dy*dy;
            const min_dist_sq = 0.01;
            const dist = std.math.sqrt(dist_sq + min_dist_sq);

            const force_magnitude = k_attraction * (dist - optimal_dist);

            const unit_dx = dx / dist;
            const unit_dy = dy / dist;

            const fx = force_magnitude * unit_dx;
            const fy = force_magnitude * unit_dy;

            node_forces.items[start_node_idx.?].fx -= fx;
            node_forces.items[start_node_idx.?].fy -= fy;

            node_forces.items[end_node_idx.?].fx += fx;
            node_forces.items[end_node_idx.?].fy += fy;
        }

        for (node_list.items, 0..) |node_ptr, i| {
            if (node_ptr.is_fixed) {
                node_ptr.velocity_x = 0.0;
                node_ptr.velocity_y = 0.0;
                continue;
            }

            node_ptr.velocity_x = (node_ptr.velocity_x + node_forces.items[i].fx) * damping_factor;
            node_ptr.velocity_y = (node_ptr.velocity_y + node_forces.items[i].fy) * damping_factor;

            const max_velocity = 5.0;
            const current_speed_sq =
                node_ptr.velocity_x * node_ptr.velocity_x +
                node_ptr.velocity_y * node_ptr.velocity_y;
            if (current_speed_sq > max_velocity*max_velocity) {
                const current_speed = std.math.sqrt(current_speed_sq);
                node_ptr.velocity_x = (node_ptr.velocity_x / current_speed) * max_velocity;
                node_ptr.velocity_y = (node_ptr.velocity_y / current_speed) * max_velocity;
            }

            node_ptr.x += node_ptr.velocity_x;
            node_ptr.y += node_ptr.velocity_y;
        }
    }
    for (node_list.items) |node_ptr| {
        node_ptr.x = snapToGrid(node_ptr.x);
        node_ptr.y = snapToGrid(node_ptr.y);
    }
}

extern fn print(f32) void;
