import { Context, Effect, Layer, pipe, Redacted } from "effect";
import * as querystring from "node:querystring";
import { Config } from "../config";

class BadStatus {
  readonly _tag = "BadStatus";
  constructor(readonly response: Response) {}
}
class FetchError {
  readonly _tag = "FetchError";
  constructor(readonly underlying: unknown) {}
}

export type GISerFuncs = Readonly<{
  gis: (query: string) => Effect.Effect<readonly ImageResult[], BadStatus | FetchError>;
}>;

export class GISer extends Context.Tag("GISer")<GISer, GISerFuncs>() {}

const BaseUrl = "https://www.googleapis.com/customsearch/v1";

type ImageResult = Readonly<{ url: string; width: number; height: number }>;

type GoogleSearchResult = {
  items?: Array<{
    link: string;
    image: {
      width: number;
      height: number;
    };
  }>;
};

export const GISerLive = Layer.effect(
  GISer,
  Effect.gen(function* () {
    const config = yield* Config;
    const { googleApiKey, googleCx } = yield* config.getConfig;
    const key = Redacted.value(googleApiKey);
    const cx = Redacted.value(googleCx);

    return GISer.of({
      gis: query =>
        pipe(
          `${BaseUrl}?${querystring.encode({ key, cx, q: query, searchType: "image" })}`,
          url => Effect.tryPromise(() => fetch(url, { method: "GET" })),
          Effect.tap(r => (r.status !== 200 ? Effect.fail(new BadStatus(r)) : Effect.void)),
          Effect.andThen(r => Effect.tryPromise(() => r.json() as Promise<GoogleSearchResult>)),
          Effect.catchTag("UnknownException", u => Effect.fail(new FetchError(u.error))),
          Effect.map(json =>
            (json.items ?? []).map(item => ({
              url: item.link,
              width: item.image.width,
              height: item.image.height,
            })),
          ),
        ),
    });
  }),
);
