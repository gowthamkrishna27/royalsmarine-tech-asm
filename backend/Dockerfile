# syntax = docker/dockerfile:1

ARG NODE_VERSION=20-slim
FROM node:${NODE_VERSION} AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment and port
ENV NODE_ENV="production"
ENV PORT=8080

# Build stage to install dependencies & compile if needed
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY package-lock.json package.json ./
RUN npm ci --include=dev

COPY . .

# Syntax check / build
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# Final stage for app image
FROM base

COPY --from=build /app /app

# Ensure uploads directory exists
RUN mkdir -p src/uploads

# Expose port 8080 for Cloud Run & Fly.io
EXPOSE 8080
CMD [ "npm", "run", "start" ]
