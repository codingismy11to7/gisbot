import { Match, Option, pipe } from "effect";

export type Mod = "g" | "t" | "i" | "a" | "m" | "l" | undefined;
const re = /^gis([gtiaml])?(\d+)? (.+)/i;

const parseNum = (n: string | undefined) =>
  pipe(
    Option.fromNullable(n),
    Option.andThen(i => parseInt(i)),
    Option.filter(i => !Number.isNaN(i)),
    Option.getOrUndefined,
  );

export const getSearchTextAndIndex = (messageText: string) =>
  pipe(
    Option.fromNullable(re.exec(messageText)),
    Option.andThen(res => ({ mod: res[1] as Mod, idx: parseNum(res[2]), search: (res[3] ?? "").trim() })),
    Option.filter(x => !!x.search.length),
    Option.andThen(({ mod, idx, search }) => ({
      index: idx ?? 1,
      mod,
      text: `${search}${Match.value(mod).pipe(
        Match.when(undefined, () => ""),
        Match.when("g", () => " girls"),
        Match.when("t", () => " then and now"),
        Match.when("i", () => " infographic"),
        Match.when("a", () => " animated gif"),
        Match.when("m", () => " meme"),
        Match.when("l", () => " sexy ladies"),
        Match.exhaustive,
      )}`,
    })),
  );
