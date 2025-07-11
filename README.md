gisbot
======

A Slack bot that performs Google Image searches directly within Slack.

## Features

-   **Simple Commands**: Use `gis [query]` to get an image.
-   **Image Indexing**: Get the 2nd, 3rd, etc., result by using an index, e.g., `gis2 [query]`.
-   **Search Modifiers**: Add special modifiers to your search for more specific results:
    -   `gisa`: Appends "animated gif" to the search and filters for `.gif` files.
    -   `gisg`: Appends "girls".
    -   `gist`: Appends "then and now".
    -   `gisi`: Appends "infographic".
    -   `gism`: Appends "meme".
    -   `gisl`: Appends "sexy ladies".

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later)
-   [Docker](https://www.docker.com/) (optional, for running in a container)

### Configuration

The application requires the following environment variables to be set:

-   `PORT`: The port for the server to listen on (e.g., `3000`).
-   `TOKENS`: A comma-separated list of valid Slack tokens for authenticating requests.

You can create a `.env` file in the project root to manage these variables locally:

```
PORT=3000
TOKENS=your-slack-token-1,your-slack-token-2
```

### Building

The project is written in TypeScript and needs to be compiled to JavaScript.

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Compile the TypeScript code:**
    The `Dockerfile` uses `npx tsc` to compile the code into the `dist` directory. For local development, you can run the same command or set up your IDE to compile on save.

### Running Locally

After building the project, you can start the server:

```bash
node dist/index.js
```

### Running with Docker

A `Dockerfile` is provided for building and running the application in a container.

1.  **Build the Docker image:**
    ```bash
    docker build -t gisbot .
    ```

2.  **Run the Docker container:**
    ```bash
    docker run -p 3000:3000 --env-file .env gisbot
    ```
    This command maps the container's port to your local machine and passes the environment variables from your `.env` file.

## Development

### Testing

The project uses Jest for testing. To run the test suite:

```bash
npm test
```

### Linting

This project uses ESLint for code quality.

-   To check for linting errors:
    ```bash
    npm run lint
    ```
-   To automatically fix linting errors:
    ```bash
    npm run lint:fix
    ```

### Modifying the Code

This project is built with `effect-ts`, a functional programming library for TypeScript. The core logic is split into several services:

-   `src/parser`: Handles parsing the raw Slack command text.
-   `src/gis`: Manages scraping Google Image Search results.
-   `src/server`: Contains the Fastify web server and handles incoming Slack requests.

When making changes, please ensure all tests pass and the code is properly linted.
