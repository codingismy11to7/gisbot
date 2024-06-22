import { Context, Effect, Layer, pipe } from "effect";
import { JSDOM } from "jsdom";

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

const BaseUrl = "https://images.google.com/search";
const UserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36";

const ImageFileExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"];
const FilterDomains = ["gstatic.com"];

const ImageURLRegex = /\["(http.+?)",(\d+),(\d+)]/g;

type ImageResult = Readonly<{ url: string; width: number; height: number }>;

const parseImages = (dom: JSDOM): readonly ImageResult[] => {
  const scripts = Array.from(dom.window.document.querySelectorAll("script"));
  const containsExtensions = scripts
    .filter(s => ImageFileExtensions.some(ext => s.innerHTML.includes(ext)))
    .map(s => s.innerHTML);

  return containsExtensions.flatMap(script =>
    Array.from(script.matchAll(ImageURLRegex)).reduce((acc, result) => {
      if (result.length <= 3) return acc;
      else {
        const [, u, h, w] = result;
        const height = parseInt(h ?? "");
        const width = parseInt(w ?? "");

        return isNaN(width) || isNaN(height) ? acc : [...acc, { url: u ?? "", width, height }];
      }
    }, [] as readonly ImageResult[]),
  );
};

export const GISerLive = Layer.succeed(
  GISer,
  GISer.of({
    gis: query =>
      pipe(
        `${BaseUrl}?tbm=isch&q=${query}${FilterDomains.map(domain => ` -site:${domain}`).join(" ")}`,
        url => Effect.tryPromise(() => fetch(url, { method: "GET", headers: { "User-Agent": UserAgent } })),
        Effect.tap(r => (r.status !== 200 ? Effect.fail(new BadStatus(r)) : Effect.void)),
        Effect.andThen(r => r.arrayBuffer()),
        Effect.catchTag("UnknownException", u => Effect.fail(new FetchError(u.error))),
        Effect.andThen(r => new JSDOM(r)),
        Effect.andThen(parseImages),
      ),
  }),
);
