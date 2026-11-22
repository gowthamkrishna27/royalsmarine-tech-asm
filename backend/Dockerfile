# Use official lightweight Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package configuration files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Ensure uploads directory exists
RUN mkdir -p src/uploads

# Cloud Run injects PORT (default 8080)
EXPOSE 8080

# Start server
CMD ["node", "src/server.js"]

