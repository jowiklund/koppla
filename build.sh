#!/bin/sh

zig build-exe src/main.zig\
	-target wasm32-freestanding\
	-fno-entry\
	--export=init \
    --export=js_string_buffer \
    --export=createCoworkerNode \
    --export=createGroupNode \
    --export=createZoneNode \
    --export=createAccessConnectorNode \
    --export=createEdge \
    --export=deleteNode \
    --export=setNodePosition \
    --export=getNodeCount \
    --export=getNodeHandleByIndex \
    --export=getNodeX \
    --export=getNodeY \
    --export=getEdgeCount \
    --export=getEdgeStartNode \
    --export=getEdgeEndNode \
    --export=getZoneTypePersonal \
    --export=getZoneTypeReadProtected \
    --export=getZoneTypeNormal \
    --export=getCoworkerAuthAdmin \
    --export=getCoworkerAuthManager \
    --export=getCoworkerAuthInternal \
    --export=getCoworkerAuthGuest \
    --export=getGraphObjectType \
    --export=getNodeNamePtr \
    --export=getNodeNameLen \
    --export=getAccessLevelAccess \
    --export=getAccessLevelManage \
    --export=getAccessLevelAdd \
    --export=getAccessLevelModify \
    --export=getAccessLevelUpdate \
	-O ReleaseSmall

rm main.wasm.o
mv main.wasm ./server/static/main.wasm
