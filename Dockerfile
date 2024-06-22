FROM node:18-slim as base

# NodeJS app lives here
WORKDIR /app

# Throw-away build stage to reduce size of final image
FROM base as build


# Install node modules
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/
RUN npm install
RUN npx tsc
RUN npm run test

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules

# Set production environment
ENV NODE_ENV=production

# Start the server by default, this can be overwritten at runtime
CMD [ "node", "dist/index.js" ]
