import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";
import { Context, Duration, Effect, HashSet, Layer, pipe, Ref } from "effect";
import Fastify from "fastify";
import { Blacklist } from "../blacklist";
import { Config } from "../config";
import { GISer, GISerFuncs } from "../gis";
import { getSearchTextAndIndex, Mod } from "../parser";

type Stats = Readonly<{ totalSearches: number; totalFailures: number }>;
const emptyStats = (): Stats => ({ totalFailures: 0, totalSearches: 0 });

class InvalidSearch {
  readonly _tag = "InvalidSearch";
}

const doSearch = (text: string, index: number, mod: Mod, giser: GISerFuncs, blacklist: readonly string[]) => {
  const badDomainsRegex = new RegExp(blacklist.map(d => `(${d})`).join("|"), "i");
  return pipe(
    Effect.timed(giser.gis(text)),
    Effect.andThen(([elapsed, result]) => ({
      result: result
        .filter(r => (blacklist.length > 0 ? !r.url.match(badDomainsRegex) : true))
        .filter(r => (mod === "a" ? r.url.endsWith(".gif") : true))[index - 1],
      elapsed,
    })),
  );
};

const isEmpty = <A>(s: HashSet.HashSet<A>) => pipe(s, HashSet.size, a => a === 0);

export class Server extends Context.Tag("Server")<Server, Readonly<{ start: Effect.Effect<void> }>>() {}
export const ServerLive = Layer.effect(
  Server,
  Effect.Do.pipe(
    Effect.bind("c", () => Config),
    Effect.bind("config", ({ c }) => c.getConfig),
    Effect.bind("giser", () => GISer),
    Effect.bind("blacklist", () => Blacklist),
    Effect.bind("stats", () => Ref.make(emptyStats())),
    Effect.andThen(({ config, stats, giser, blacklist }) =>
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

                const trimmedText = req.body.text.trim();

                const handleBlacklistCommands = () => {
                  if (trimmedText === "gisblacklist") {
                    return pipe(
                      blacklist.get,
                      Effect.map(domains => resp(`Current blacklist:\n${domains.join("\n")}`)),
                    );
                  }
                  if (trimmedText.startsWith("gisblacklist add ")) {
                    const domain = trimmedText.substring("gisblacklist add ".length).trim();
                    return pipe(
                      blacklist.add(domain),
                      Effect.map(() => resp(`Added ${domain} to blacklist`)),
                    );
                  }
                  if (trimmedText.startsWith("gisblacklist remove ")) {
                    const domain = trimmedText.substring("gisblacklist remove ".length).trim();
                    return pipe(
                      blacklist.remove(domain),
                      Effect.map(() => resp(`Removed ${domain} from blacklist`)),
                    );
                  }
                  return null;
                };

                const blacklistCmd = handleBlacklistCommands();

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
                    : (blacklistCmd !== null
                        ? blacklistCmd
                        : trimmedText === "gisstats"
                        ? pipe(
                            stats.get,
                            Effect.map(s =>
                              resp(`total searches: ${s.totalSearches}, total failures: ${s.totalFailures}`),
                            ),
                          )
                        : pipe(
                            getSearchTextAndIndex(req.body.text.replaceAll("&amp;", "&")),
                            Effect.catchTag("NoSuchElementException", () => Effect.fail(new InvalidSearch())),
                            Effect.tap(parsed => Effect.logInfo(`calling with search text: '${parsed.text}'`)),
                            Effect.tap(stats.pipe(Ref.update(s => ({ ...s, totalSearches: 1 + s.totalSearches })))),
                            Effect.andThen(({ text, index, mod }) =>
                              pipe(
                                blacklist.get,
                                Effect.andThen(bl => doSearch(text, index, mod, giser, bl)),
                              ),
                            ),
                            Effect.andThen(({ result, elapsed }) =>
                              result === undefined
                                ? unknown
                                : Effect.succeed(
                                    resp(
                                      `${result.url
                                        .replace(/%25/g, "%25")
                                        .replace(/\\u003d/g, "=")
                                        .replace(/\\u0026/g, "&")} (${elapsed
                                        .pipe(Duration.toSeconds)
                                        .toFixed(2)} sec)`,
                                    ),
                                  ),
                            ),
                            Effect.catchTags({
                              InvalidSearch: () => unknown,
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                              BadStatus: (b: any) => handleFailure(Effect.logWarning("got a bad status", b.response)),
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                              FetchError: (f: any) => handleFailure(Effect.logError("got a fetch error", f.underlying)),
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

export const forTesting = { doSearch };
