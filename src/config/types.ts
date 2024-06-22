import { HashSet } from "effect";

export type AppConfig = Readonly<{
  port: number;
  validTokens: HashSet.HashSet<string>;
}>;
