import { Option } from "effect";
import { getSearchTextAndIndex } from "./index";

const run = (s: string) => getSearchTextAndIndex(s).pipe(Option.getOrUndefined);

describe("parser", () => {
  it("all options work", () => {
    expect(run("gisa42    xyz  ")).toEqual({ index: 42, mod: "a", text: "xyz animated gif" });
  });

  it.each([
    ["g", "girls"],
    ["t", "then and now"],
    ["i", "infographic"],
    ["a", "animated gif"],
    ["m", "meme"],
    ["l", "sexy ladies"],
    ["", ""],
  ])("'%s' mod is handled", (mod, searchSuff) => {
    expect(run(`gis${mod} a`)?.text).toEqual(`a${!searchSuff.length ? "" : ` ${searchSuff}`}`);
  });

  it("index works", () => {
    expect(run("gis x")?.index).toEqual(1);
    expect(run("gis1 x")?.index).toEqual(1);
    expect(run("gis42 x")?.index).toEqual(42);
    expect(run("gisi42 x")?.index).toEqual(42);
  });

  it("no search string is none", () => {
    expect(run("gis ")).toBeUndefined();
    expect(run("gisi ")).toBeUndefined();
    expect(run("gis      ")).toBeUndefined();
    expect(run("gisa42    ")).toBeUndefined();
  });
});
