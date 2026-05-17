# Stage 1: Build React App
FROM node:18 AS build

# Accept build argument for API base URL
ARG REACT_APP_API_BASE=http://localhost:8080

# Set it as environment variable so React can read it during build
ENV REACT_APP_API_BASE=${REACT_APP_API_BASE}

COPY . .
RUN npm install && npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /build /usr/share/nginx/html

# Configures Nginx to handle React Router correctly
RUN echo "server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]