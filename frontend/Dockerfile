# Production Dockerfile for Frontend
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install scripts first for better Docker layer caching
COPY package.json package-lock.json .npmrc ./
COPY scripts ./scripts
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build application
ENV REACT_APP_BACKEND_URL=
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
