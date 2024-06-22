import { Effect, pipe } from "effect";
import { Config, ConfigLive } from "./config";

const program = pipe(
  Config,
  Effect.andThen(c => c.getConfig),
  Effect.andThen(c => Effect.logInfo(c)),
);

void Effect.runPromise(program.pipe(Effect.provide(ConfigLive)));
