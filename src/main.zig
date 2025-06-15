const std = @import("std");

var memory_buffer: [16 * 1024 * 1024]u8 align(16) = undefined;
var fba: std.heap.FixedBufferAllocator = undefined;

pub export var js_string_buffer: [256]u8 = undefined;

const NodeHandle = usize;

pub const ZoneType = enum(u8) {
    personal,
    read_protected,
    normal,
};

pub const CoworkerAuth = enum(u8) {
    admin,
    manager,
    internal,
    guest
};

pub const AccessLevel = enum(u8) {
    access,
    manage,
    modify,
    update,
    add,
};

const Coworker = struct {
    name: [32]u8,
    auth: CoworkerAuth,
};

const Group = struct {
    name: [32]u8,
};

const Zone = struct {
    name: [32]u8,
    zone_type: ZoneType,
};

const AccessConnector = struct {
    name: [32]u8,
    access_level: AccessLevel,
};

const GraphObject = union(enum) {
    coworker: Coworker,
    group: Group,
    zone: Zone,
    access_connector: AccessConnector
};

pub const Node = struct {
    x: f32,
    y: f32,
    data: GraphObject,
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

fn createNodeAndAppend(x: f32, y: f32, data: GraphObject) *Node {
    const node = fba.allocator().create(Node) catch @panic("OOM: Node");
    node.* = .{
        .x = x,
        .y = y,
        .data = data,
        .edges_incoming = std.ArrayList(NodeHandle).init(fba.allocator()),
        .edges_outgoing = std.ArrayList(NodeHandle).init(fba.allocator()),
        .mass = 1.0,
        .is_fixed = false,
        .velocity_x = 0.0,
        .velocity_y = 0.0,
    };

    node_list.append(node) catch @panic("OOM: Node list");
    return node;
}

export fn getZoneTypePersonal() u8 { return @intFromEnum(ZoneType.personal); }
export fn getZoneTypeReadProtected() u8 { return @intFromEnum(ZoneType.read_protected); }
export fn getZoneTypeNormal() u8 { return @intFromEnum(ZoneType.normal); }

export fn getCoworkerAuthAdmin() u8 { return @intFromEnum(CoworkerAuth.admin); }
export fn getCoworkerAuthManager() u8 { return @intFromEnum(CoworkerAuth.manager); }
export fn getCoworkerAuthInternal() u8 { return @intFromEnum(CoworkerAuth.internal); }
export fn getCoworkerAuthGuest() u8 { return @intFromEnum(CoworkerAuth.guest); }

export fn getAccessLevelAccess() u8 { return @intFromEnum(AccessLevel.access); }
export fn getAccessLevelManage() u8 { return @intFromEnum(AccessLevel.manage); }
export fn getAccessLevelAdd() u8 { return @intFromEnum(AccessLevel.add); }
export fn getAccessLevelModify() u8 { return @intFromEnum(AccessLevel.modify); }
export fn getAccessLevelUpdate() u8 { return @intFromEnum(AccessLevel.update); }

fn copyName(name_buffer: *[32]u8, name_len: usize) void {
    const len = @min(name_len, name_buffer.len);
    @memcpy(name_buffer[0..len], js_string_buffer[0..len]);
    if (len < name_buffer.len) {
        @memset(name_buffer[len..], 0);
    }
}

export fn createCoworkerNode(
    x: f32,
    y: f32,
    name_len: usize,
    auth_level: u8
) usize {
    var name_buffer: [32]u8 = undefined;
    copyName(&name_buffer, name_len);

    const coworker = Coworker{
        .name = name_buffer,
        .auth = @enumFromInt(auth_level),
    };

    const node = createNodeAndAppend(x, y, .{ .coworker = coworker} );
    return @intFromPtr(node);
}

export fn createGroupNode(
    x: f32,
    y: f32,
    name_len: usize
) usize {
    var name_buffer: [32]u8 = undefined;
    copyName(&name_buffer, name_len);

    const group = Group{
        .name = name_buffer,
    };

    const node = createNodeAndAppend(x, y, .{ .group = group } );
    return @intFromPtr(node);
}

export fn createZoneNode(
    x: f32,
    y: f32,
    name_len: usize,
    zone_type: u8
) usize {
    var name_buffer: [32]u8 = undefined;
    copyName(&name_buffer, name_len);

    const zone = Zone{
        .name = name_buffer,
        .zone_type = @enumFromInt(zone_type),
    };

    const node = createNodeAndAppend(x, y, .{ .zone = zone } );
    return @intFromPtr(node);
}

export fn createAccessConnectorNode(
    x: f32,
    y: f32,
    name_len: usize,
    access_level: u8
) usize {
    var name_buffer: [32]u8 = undefined;
    copyName(&name_buffer, name_len);

    const access_connector = AccessConnector{
        .name = name_buffer,
        .access_level = @enumFromInt(access_level),
    };

    const node = createNodeAndAppend(x, y, .{ .access_connector = access_connector} );
    return @intFromPtr(node);
}

export fn createEdge(start_handle: usize, end_handle: usize) void {
    const start_node: *Node = @ptrFromInt(start_handle);
    const end_node: *Node = @ptrFromInt(end_handle);
    start_node.edges_outgoing.append(end_handle) catch @panic("OOM: Node outgoing");
    end_node.edges_incoming.append(start_handle) catch @panic("OOM: Node incoming");
}

export fn deleteNode(handle: usize) void {
    const node_to_delete: *Node = @ptrFromInt(handle);

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

    var i = node_list.items.len;
    while (i > 0) {
        i -= 1;
        if (node_list.items[i] == node_to_delete) {
            _ = node_list.orderedRemove(i);
            break;
        }
    }

    node_to_delete.edges_incoming.deinit();
    node_to_delete.edges_outgoing.deinit();
    fba.allocator().destroy(node_to_delete);
}

export fn getNodeX(handle: usize) f32 {
    const node_ptr: *const Node = @ptrFromInt(handle);
    return node_ptr.x;
}

export fn getNodeY(handle: usize) f32 {
    const node_ptr: *const Node = @ptrFromInt(handle);
    return node_ptr.y;
}

export fn getNodeZoneType(handle: usize) f32 {
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

export fn getGraphObjectType(handle: usize) u8 {
    const node_ptr: *Node = @ptrFromInt(handle);
    return @intFromEnum(node_ptr.data);
}

export fn getZoneNodeZoneType(handle: usize) u8 {
    const node: *Node = @ptrFromInt(handle);
    return switch (node.data) {
        .zone => @intFromEnum(node.data.zone.zone_type),
        else => unreachable
    };
}

export fn getCoworkerNodeAuth(handle: usize) u8 {
    const node: *Node = @ptrFromInt(handle);
    return switch (node.data) {
        .coworker => @intFromEnum(node.data.coworker.auth),
        else => unreachable,
    };
}

export fn getAccessNodeAccessLevel(handle: usize) u8 {
    const node: *Node = @ptrFromInt(handle);
    return switch (node.data) {
        .access_connector => @intFromEnum(node.data.access_connector.access_level),
        else => unreachable,
    };
}

export fn getNodeNamePtr(handle: usize) usize {
    const node: *Node = @ptrFromInt(handle);
    return switch (node.data) {
        .coworker => @intFromPtr(&node.data.coworker.name),
        .group => @intFromPtr(&node.data.group.name),
        .zone => @intFromPtr(&node.data.zone.name),
        .access_connector => @intFromPtr(&node.data.access_connector.name),
    };
}

export fn getNodeNameLen(handle: usize) usize {
    const node: *Node = @ptrFromInt(handle);
    const name_slice = switch (node.data) {
        .coworker => |c| c.name[0..],
        .group => |g| g.name[0..],
        .zone => |z| z.name[0..],
        .access_connector => |a| a.name[0..],
    };
    return std.mem.indexOf(u8, name_slice, &.{0}) orelse name_slice.len;
}

extern fn print(usize) void;
