FROM node:20-alpine AS builder

WORKDIR /usr/src/app

RUN npm install -g pnpm

# Copy dependency definition files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install

# Copy the rest of the project source code
COPY . .

RUN pnpm --filter demo-app build


FROM nginx:1.25-alpine

COPY --from=builder /usr/src/app/apps/demo/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
