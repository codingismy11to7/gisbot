import { Effect } from "effect";
import { GISer, GISerLive } from "./service";

describe("GISer", () => {
  it("includes blacklisted domains in search query", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        status: 200,
        arrayBuffer: () => Promise.resolve(Buffer.from("")),
      } as unknown as Response),
    );

    const program = Effect.gen(function* (_) {
      const giser = yield* _(GISer);
      yield* _(giser.gis("test query"));
    }).pipe(Effect.provide(GISerLive));

    // We expect it to potentially fail due to empty response parsing, but we check the fetch call
    await Effect.runPromise(program).catch(() => {});

    expect(fetchSpy).toHaveBeenCalled();
    const call = fetchSpy.mock.calls[0];
    if (!call) {
      throw new Error("Fetch was not called");
    }
    const url = call[0] as string;

    // Check that the URL contains the encoded query
    // " -site:yarn.co" encodes to something like "%20-site%3Ayarn.co"
    // But we can check for the decoded version or just part of it if querystring encodes it.
    // node:querystring encodes spaces as %20 or + depending on implementation, and : as %3A

    // Let's print the URL to be sure if the test fails, but generally we expect the blacklist logic to be present.
    // simpler to check if "yarn.co" is present in the URL string, regardless of encoding,
    // but better to match the specific site exclusion param pattern.

    expect(url).toContain("yarn.co");
    expect(url).toContain("gstatic.com");

    fetchSpy.mockRestore();
  });
});
