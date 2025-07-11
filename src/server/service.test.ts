import { Duration, Effect, Fiber, TestClock, TestContext } from "effect";
import { forTesting } from "./service";

const { doSearch } = forTesting;

describe("server", () => {
  it("doSearch returns proper elapsed time", () =>
    Effect.gen(function* () {
      const fiber = yield* doSearch("a", 1, undefined, {
        gis: () => Effect.succeed([{ url: "a", width: 1, height: 1 }]).pipe(Effect.delay("500 millis")),
      }).pipe(Effect.fork);

      yield* TestClock.adjust("750 millis");

      const res = yield* Fiber.join(fiber);

      expect(res.elapsed.pipe(Duration.toMillis)).toEqual(500);
    }).pipe(Effect.provide(TestContext.TestContext), Effect.runPromise));

  it("doSearch with 'a' mod filters for gifs", () =>
    Effect.gen(function* () {
      const res = yield* doSearch("a", 1, "a", {
        gis: () =>
          Effect.succeed([
            { url: "a.jpg", width: 1, height: 1 },
            { url: "b.gif", width: 1, height: 1 },
            { url: "c.png", width: 1, height: 1 },
          ]),
      });

      expect(res.result?.url).toEqual("b.gif");
    }).pipe(Effect.runPromise));
});
