import { ConfigProvider, Effect, Either, HashSet, Layer, pipe } from "effect";
import { InvalidData } from "effect/ConfigError";
import { forTesting } from "./service";

const { createConfig } = forTesting;

const P = "PORT";
const WT = "WEBHOOK_TOKENS";

const createConf = (conf: Map<string, string>) =>
  pipe(createConfig(), Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(conf))));

describe("config", () => {
  it("succeeds with valid input", async () => {
    const r1 = await createConf(new Map([[P, "8080"]])).pipe(Effect.runPromise);
    expect(r1).toEqual({ port: 8080, validTokens: HashSet.empty() });

    const r2 = await createConf(
      new Map([
        [P, "8080"],
        [WT, "a,b"],
      ]),
    ).pipe(Effect.runPromise);
    expect(r2).toEqual({
      port: 8080,
      validTokens: HashSet.fromIterable(["a", "b"]),
    });
  });

  it.each([0, -1, 3.141, 65536])("fails with invalid port numbers", async p => {
    const r = await createConf(new Map([[P, p.toString()]])).pipe(Effect.either, Effect.runPromise);

    expect(r.pipe(Either.flip, Either.getOrNull)).toEqual(
      InvalidData([P], expect.stringMatching(`xpected ${p} to be an int .* valid port`)),
    );
  });
});
