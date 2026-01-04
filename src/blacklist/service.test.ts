import { Effect } from "effect";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BlacklistLive } from "./service";
import { Blacklist } from "./types";

const BLACKLIST_FILE = path.join(process.cwd(), "blacklist.json");

describe("Blacklist service", () => {
  beforeEach(async () => {
    try {
      await fs.unlink(BLACKLIST_FILE);
    } catch (e) {
      // ignore
    }
  });

  afterAll(async () => {
    try {
      await fs.unlink(BLACKLIST_FILE);
    } catch (e) {
      // ignore
    }
  });

  it("should initialize with default domains if file does not exist", () =>
    Effect.gen(function* () {
      const blacklist = yield* Blacklist;
      const domains = yield* blacklist.get;
      expect(domains).toContain("alamy\\.com");
      expect(domains.length).toBeGreaterThan(0);
    }).pipe(Effect.provide(BlacklistLive), Effect.runPromise));

  it("should add a domain", () =>
    Effect.gen(function* () {
      const blacklist = yield* Blacklist;
      yield* blacklist.add("newdomain.com");
      const domains = yield* blacklist.get;
      expect(domains).toContain("newdomain.com");

      // Verify persistence
      const fileContent = yield* Effect.promise(() => fs.readFile(BLACKLIST_FILE, "utf-8"));
      expect(JSON.parse(fileContent)).toContain("newdomain.com");
    }).pipe(Effect.provide(BlacklistLive), Effect.runPromise));

  it("should remove a domain", () =>
    Effect.gen(function* () {
      const blacklist = yield* Blacklist;
      yield* blacklist.add("tobremoved.com");
      yield* blacklist.remove("tobremoved.com");
      const domains = yield* blacklist.get;
      expect(domains).not.toContain("tobremoved.com");

      // Verify persistence
      const fileContent = yield* Effect.promise(() => fs.readFile(BLACKLIST_FILE, "utf-8"));
      expect(JSON.parse(fileContent)).not.toContain("tobremoved.com");
    }).pipe(Effect.provide(BlacklistLive), Effect.runPromise));
});
