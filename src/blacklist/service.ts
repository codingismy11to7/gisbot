import { Effect, Layer, Ref, pipe } from "effect";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Blacklist } from "./types";

const INITIAL_DOMAINS = [
  "alamy\\.com",
  "depositphotos\\.com",
  "shutterstock\\.com",
  "maps\\.google\\.com",
  "fbsbx.*\\.com",
  "memegenerator.*\\.net",
  "gstatic.*\\.com",
  "instagram.*\\.com",
  "tiktok.*\\.com",
];

const BLACKLIST_FILE = path.join(process.cwd(), "blacklist.json");

const load = Effect.tryPromise({
  try: async () => {
    try {
      const data = await fs.readFile(BLACKLIST_FILE, "utf-8");
      return JSON.parse(data) as string[];
    } catch (e) {
      return INITIAL_DOMAINS;
    }
  },
  catch: error => error,
});

const save = (domains: readonly string[]) =>
  Effect.tryPromise({
    try: () => fs.writeFile(BLACKLIST_FILE, JSON.stringify(domains, null, 2), "utf-8"),
    catch: error => error,
  });

export const BlacklistLive = Layer.effect(
  Blacklist,
  pipe(
    load,
    Effect.andThen(domains => Ref.make(domains)),
    Effect.map(ref =>
      Blacklist.of({
        get: Ref.get(ref),
        add: domain =>
          pipe(
            Ref.update(ref, domains => (domains.includes(domain) ? domains : [...domains, domain])),
            Effect.andThen(Ref.get(ref)),
            Effect.andThen(save),
            Effect.ignore,
          ),
        remove: domain =>
          pipe(
            Ref.update(ref, domains => domains.filter(d => d !== domain)),
            Effect.andThen(Ref.get(ref)),
            Effect.andThen(save),
            Effect.ignore,
          ),
      }),
    ),
  ),
);
