#!/bin/sh

zig build-exe src/main.zig\
    -target wasm32-freestanding\
    -fno-entry\
    --export=init \
    --export=js_string_buffer \
    --export=createNode \
    --export=createEdge \
    --export=deleteNode \
    --export=setNodePosition \
    --export=getNodeCount \
    --export=getNodeHandleByIndex \
    --export=getNodeX \
    --export=getNodeY \
    --export=getNodeOutgoingCount \
    --export=getNodeOutgoingHandleByIndex \
    --export=getNodeIncomingCount \
    --export=getNodeIncomingHandleByIndex \
    --export=getEdgeHandleByIndex \
    --export=getEdgeCount \
    --export=getEdgeStartNodeHandle \
    --export=getEdgeEndNodeHandle \
    --export=getEdgeType \
    --export=deleteEdge \
    -O ReleaseSmall

rm main.wasm.o
mv main.wasm ./server/static/main.wasm
