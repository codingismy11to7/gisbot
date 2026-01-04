import { Effect, Context } from "effect";

export interface BlacklistFuncs {
  readonly get: Effect.Effect<readonly string[]>;
  readonly add: (domain: string) => Effect.Effect<void>;
  readonly remove: (domain: string) => Effect.Effect<void>;
}

export class Blacklist extends Context.Tag("Blacklist")<Blacklist, BlacklistFuncs>() {}
