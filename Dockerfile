FROM node:18-slim as base

# NodeJS app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production


# Throw-away build stage to reduce size of final image
FROM base as build


# Install node modules
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/
RUN npm install --production=false
RUN npx tsc

# Remove development dependencies
RUN npm prune --production


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules

# Start the server by default, this can be overwritten at runtime
CMD [ "node", "dist/index.js" ]
