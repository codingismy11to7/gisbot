import { Effect, Layer, pipe } from "effect";
import { ConfigLive } from "./config";
import { GISerLive } from "./gis";
import { Server, ServerLive } from "./server";

const program = pipe(
  Server,
  Effect.andThen(s => s.start),
);

const AppLive = ServerLive.pipe(Layer.provide(GISerLive), Layer.provide(ConfigLive));

void Effect.runPromise(program.pipe(Effect.provide(AppLive)));
