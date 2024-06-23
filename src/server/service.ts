import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";
import { Clock, Context, Effect, HashSet, Layer, pipe, Ref } from "effect";
import Fastify from "fastify";
import { Config } from "../config";
import { GISer, GISerFuncs } from "../gis";
import { getSearchTextAndIndex } from "../parser";

type Stats = Readonly<{ totalSearches: number; totalFailures: number }>;
const emptyStats = (): Stats => ({ totalFailures: 0, totalSearches: 0 });

class InvalidSearch {
  readonly _tag = "InvalidSearch";
}

const BadDomains =
  /(maps\.google\.com)|(fbsbx.*\.com)|(memegenerator.*\.net)|(gstatic.*\.com)|(instagram.*\.com)|(tiktok.*\.com)/i;

const doSearch = (text: string, index: number, giser: GISerFuncs) =>
  pipe(
    timed(giser.gis(text)),
    Effect.andThen(({ result, elapsed }) => ({
      result: result.filter(r => !r.url.match(BadDomains))[index - 1],
      elapsed,
    })),
  );

const timed = <A, E, R>(e: Effect.Effect<A, E, R>): Effect.Effect<Readonly<{ result: A; elapsed: bigint }>, E, R> =>
  Effect.Do.pipe(
    Effect.bind("start", () => Clock.currentTimeNanos),
    Effect.bind("result", () => e),
    Effect.bind("end", () => Clock.currentTimeNanos),
    Effect.let("elapsed", ({ start, end }) => end - start),
    Effect.andThen(({ result, elapsed }) => ({ result, elapsed })),
  );

const isEmpty = <A>(s: HashSet.HashSet<A>) => pipe(s, HashSet.size, a => a === 0);

export class Server extends Context.Tag("Server")<Server, Readonly<{ start: Effect.Effect<void> }>>() {}
export const ServerLive = Layer.effect(
  Server,
  Effect.Do.pipe(
    Effect.bind("c", () => Config),
    Effect.bind("config", ({ c }) => c.getConfig),
    Effect.bind("giser", () => GISer),
    Effect.bind("stats", () => Ref.make(emptyStats())),
    Effect.andThen(({ config, stats, giser }) =>
      Server.of({
        start: Effect.promise(() =>
          Fastify()
            .withTypeProvider<JsonSchemaToTsProvider>()
            .register(import("@fastify/cors"))
            .register(import("@fastify/formbody"))
            .route({
              method: "POST",
              url: "/",
              schema: {
                body: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    user_name: { type: "string" },
                    text: { type: "string" },
                    channel_id: { type: "string" },
                  },
                  required: ["user_name", "text", "channel_id", "token"],
                },
                response: {
                  200: {
                    oneOf: [
                      { type: "string" },
                      {
                        type: "object",
                        properties: {
                          username: { enum: ["google-image-search"] },
                          channel: { type: "string" },
                          text: { type: "string" },
                        },
                        required: ["username", "channel", "text"],
                      },
                    ],
                  },
                  404: {},
                },
              },
              handler: (req, rep) => {
                const resp = (text: string) => ({
                  username: "google-image-search" as const,
                  channel: req.body.channel_id,
                  text,
                });
                const unknown = Effect.succeed(resp("¯\\_(ツ)_/¯"));
                const handleFailure = (e: Effect.Effect<unknown>) =>
                  pipe(
                    stats,
                    Ref.update(s => ({ ...s, totalFailures: 1 + s.totalFailures })),
                    Effect.andThen(e),
                    Effect.andThen(unknown),
                  );

                return pipe(isEmpty(config.validTokens), empty =>
                  empty
                    ? Effect.logError("no tokens configured").pipe(
                        Effect.andThen(() => rep.status(500).send("server error")),
                        Effect.runPromise,
                      )
                    : !config.validTokens.pipe(HashSet.has(req.body.token))
                    ? rep.status(404).send("nope")
                    : req.body.user_name === "slackbot"
                    ? "hey let's not make any infinite loops"
                    : (req.body.text.trim() === "gisstats"
                        ? pipe(
                            stats.get,
                            Effect.andThen(s =>
                              resp(`total searches: ${s.totalSearches}, total failures: ${s.totalFailures}`),
                            ),
                          )
                        : pipe(
                            getSearchTextAndIndex(req.body.text.replaceAll("&amp;", "&")),
                            Effect.catchTag("NoSuchElementException", () => Effect.fail(new InvalidSearch())),
                            Effect.tap(parsed => Effect.logInfo(`calling with search text: '${parsed.text}'`)),
                            Effect.tap(stats.pipe(Ref.update(s => ({ ...s, totalSearches: 1 + s.totalSearches })))),
                            Effect.andThen(({ text, index }) => doSearch(text, index, giser)),
                            Effect.andThen(({ result, elapsed }) =>
                              result === undefined
                                ? unknown
                                : resp(
                                    `${result.url
                                      .replace(/%25/g, "%")
                                      .replace(/\\u003d/g, "=")
                                      .replace(/\\u0026/g, "&")} (${Number(elapsed / 1_000_000_000n).toFixed(2)} sec)`,
                                  ),
                            ),
                            Effect.catchTags({
                              InvalidSearch: () => unknown,
                              BadStatus: b => handleFailure(Effect.logWarning("got a bad status", b.response)),
                              FetchError: f => handleFailure(Effect.logError("got a fetch error", f.underlying)),
                            }),
                          )
                      ).pipe(Effect.runPromise),
                );
              },
            })
            .listen({ host: "0.0.0.0", port: config.port }),
        ),
      }),
    ),
  ),
);
