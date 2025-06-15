const std = @import("std");

var memory_buffer: [16 * 1024 * 1024]u8 align(16) = undefined;
var fba: std.heap.FixedBufferAllocator = undefined;

pub export var js_string_buffer: [256]u8 = undefined;

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
};

pub const Edge = struct {
    start_node_handle: usize,
    end_node_handle: usize,
};

var node_list: std.ArrayList(*Node) = undefined;
var edge_list: std.ArrayList(Edge) = undefined;

export fn init() void {
    fba = std.heap.FixedBufferAllocator.init(&memory_buffer);
    node_list = std.ArrayList(*Node).init(fba.allocator());
    edge_list = std.ArrayList(Edge).init(fba.allocator());
}

fn createNodeAndAppend(x: f32, y: f32, data: GraphObject) *Node {
    const node = fba.allocator().create(Node) catch @panic("OOM: Node");
    node.* = .{
        .x = x,
        .y = y,
        .data = data,
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
    const edge = Edge{
        .start_node_handle = start_handle,
        .end_node_handle = end_handle
    };
    edge_list.append(edge) catch @panic("OOM: Edge list");
}


export fn deleteNode(handle: usize) void {
    const node_to_delete: *Node = @ptrFromInt(handle);

    var i = edge_list.items.len;
    while (i > 0) {
        i -= 1;
        const edge = edge_list.items[i];
        if (edge.start_node_handle == handle or edge.end_node_handle == handle) {
            _ = edge_list.orderedRemove(i);
        }
    }

    i = 0;
    while (i < node_list.items.len) : (i += 1) {
        if (node_list.items[i] == node_to_delete) {
            _ = node_list.orderedRemove(i);
            break;
        }
    }

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

export fn setNodePosition(handle: usize, new_x: f32, new_y: f32) void {
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

export fn getEdgeCount() usize {
    return edge_list.items.len;
}

export fn getEdgeStartNode(index: usize) usize {
    return edge_list.items[index].start_node_handle;
}

export fn getEdgeEndNode(index: usize) usize {
    return edge_list.items[index].end_node_handle;
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

extern fn print(i32) void;
