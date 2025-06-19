FROM node:20-alpine AS builder
WORKDIR /usr/src/app

RUN apk add --no-cache wget tar xz

ENV ZIG_VERSION=0.14.0
RUN wget https://ziglang.org/download/${ZIG_VERSION}/zig-linux-x86_64-${ZIG_VERSION}.tar.xz && \
    tar -xf zig-linux-x86_64-${ZIG_VERSION}.tar.xz && \
    mv zig-linux-x86_64-${ZIG_VERSION} /usr/local/zig && \
    rm zig-linux-x86_64-${ZIG_VERSION}.tar.xz

ENV PATH="/usr/local/zig:${PATH}"

RUN npm install -g pnpm

COPY . .

RUN echo "inject-workspace-packages=true" > .npmrc
RUN pnpm install
RUN mkdir -p packages/engine/public
RUN pnpm --filter "./packages/**" build
RUN mkdir -p apps/demo/public && cp packages/engine/public/main.wasm apps/demo/public/
RUN pnpm --filter demo-app build

FROM nginx:1.25-alpine

COPY --from=builder /usr/src/app/apps/demo/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
