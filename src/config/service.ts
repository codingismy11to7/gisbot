import { Config as C, Context, Effect, Either, HashSet, Layer, Option, pipe, Redacted } from "effect";
import { InvalidData } from "effect/ConfigError";
import { readFileSync } from "node:fs";
import { AppConfig } from "./types";

const portConf = pipe(
  C.number("PORT"),
  C.mapOrFail(n =>
    Number.isInteger(n) && n > 0 && n <= 65_535
      ? Either.right(n)
      : Either.left(InvalidData([], `Expected ${n} to be an int in the valid port range`)),
  ),
);

const tokensConf = C.hashSet(C.string(), "WEBHOOK_TOKENS").pipe(C.withDefault(HashSet.empty<string>()));

const redacted = (name: string) =>
  pipe(
    C.string(`${name}_FILE`),
    C.option,
    C.mapAttempt(Option.getOrThrow),
    C.map(fName =>
      // configs are synchronous, so have to go to native node
      readFileSync(fName, { encoding: "utf8" }).trim(),
    ),
    C.map(Redacted.make),
    C.orElse(() => C.redacted(name)),
  );

const googleApiKeyConf = redacted("GOOGLE_API_KEY");
const googleCxConf = redacted("GOOGLE_SEARCH_ENGINE_ID");

const createConfig = (): C.Config<AppConfig> =>
  pipe(
    C.all([portConf, tokensConf, googleApiKeyConf, googleCxConf]),
    C.map(([port, validTokens, googleApiKey, googleCx]) => ({ port, validTokens, googleApiKey, googleCx })),
  );

export class Config extends Context.Tag("Config")<Config, Readonly<{ getConfig: Effect.Effect<AppConfig> }>>() {}
export const ConfigLive = Layer.effect(
  Config,
  createConfig().pipe(Effect.map(c => Config.of({ getConfig: Effect.succeed(c) }))),
);

export const forTesting = { createConfig };
