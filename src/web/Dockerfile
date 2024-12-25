# ===== Build Stage =====
FROM node:20-alpine AS builder

# Set build arguments
ARG BUILD_VERSION
ARG NODE_ENV=production

# Set working directory
WORKDIR /app

# Install additional security packages
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with strict security and integrity checks
RUN npm ci --production=false \
    && npm cache clean --force

# Copy source code and configuration files
COPY . .

# Set production environment
ENV NODE_ENV=production \
    BUILD_VERSION=${BUILD_VERSION}

# Build the application
RUN npm run build \
    && npm prune --production

# Validate build output
RUN test -d dist || exit 1

# ===== Production Stage =====
FROM nginx:1.25-alpine AS production

# Set build arguments
ARG BUILD_VERSION
ENV BUILD_VERSION=${BUILD_VERSION}

# Install security updates and remove unnecessary tools
RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl tzdata && \
    rm -rf /var/cache/apk/*

# Create non-root nginx user
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Configure security settings
RUN chmod -R 755 /usr/share/nginx/html && \
    chmod -R 755 /var/cache/nginx && \
    chmod -R 755 /var/log/nginx && \
    chmod -R 755 /etc/nginx/conf.d

# Remove default nginx configuration
RUN rm -rf /etc/nginx/conf.d/default.conf

# Switch to non-root user
USER nginx

# Configure health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Set resource limits
ENV NGINX_WORKER_PROCESSES="auto" \
    NGINX_WORKER_CONNECTIONS="1024" \
    NGINX_WORKER_RLIMIT_NOFILE="65535"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Metadata labels
LABEL maintainer="Knowledge Curator Team" \
      version="${BUILD_VERSION}" \
      description="Knowledge Curator Web Application" \
      security.updates="true" \
      org.opencontainers.image.source="https://github.com/knowledge-curator/web" \
      org.opencontainers.image.vendor="Knowledge Curator" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.title="Knowledge Curator Web" \
      org.opencontainers.image.description="Frontend web application for Knowledge Curator platform" \
      org.opencontainers.image.licenses="Proprietary"