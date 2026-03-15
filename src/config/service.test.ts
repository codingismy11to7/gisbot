import { ConfigProvider, Effect, Either, HashSet, Layer, pipe, Redacted } from "effect";
import { InvalidData } from "effect/ConfigError";
import { forTesting } from "./service";

const { createConfig } = forTesting;

const P = "PORT";
const WT = "WEBHOOK_TOKENS";
const GAK = "GOOGLE_API_KEY";
const GCX = "GOOGLE_SEARCH_ENGINE_ID";

const createConf = (conf: Map<string, string>) =>
  pipe(createConfig(), Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(conf))));

const validBase = new Map([
  [GAK, "some-key"],
  [GCX, "some-cx"],
]);

describe("config", () => {
  it("succeeds with valid input", async () => {
    const r1 = await createConf(new Map([...validBase, [P, "8080"]])).pipe(Effect.runPromise);
    expect(r1).toEqual({
      port: 8080,
      validTokens: HashSet.empty(),
      googleApiKey: Redacted.make("some-key"),
      googleCx: Redacted.make("some-cx"),
    });

    const r2 = await createConf(new Map([...validBase, [P, "8080"], [WT, "a,b"]])).pipe(Effect.runPromise);
    expect(r2).toEqual({
      port: 8080,
      validTokens: HashSet.fromIterable(["a", "b"]),
      googleApiKey: Redacted.make("some-key"),
      googleCx: Redacted.make("some-cx"),
    });
  });

  it.each([0, -1, 3.141, 65536])("fails with invalid port numbers", async p => {
    const r = await createConf(new Map([...validBase, [P, p.toString()]])).pipe(Effect.either, Effect.runPromise);

    expect(r.pipe(Either.flip, Either.getOrNull)).toEqual(
      InvalidData([P], expect.stringMatching(`xpected ${p} to be an int .* valid port`)),
    );
  });

  it("loads secrets from _FILE if provided", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `gisbot-test-key-${Date.now()}`);
    fs.writeFileSync(tmpFile, "secret-from-file");

    try {
      const r = await createConf(
        new Map([
          [GAK + "_FILE", tmpFile],
          [GCX, "some-cx"],
          [P, "8080"],
        ]),
      ).pipe(Effect.runPromise);
      expect(r.googleApiKey).toEqual(Redacted.make("secret-from-file"));
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
