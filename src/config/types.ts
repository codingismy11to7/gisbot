import { HashSet, Redacted } from "effect";

export type AppConfig = Readonly<{
  port: number;
  validTokens: HashSet.HashSet<string>;
  googleApiKey: Redacted.Redacted;
  googleCx: Redacted.Redacted;
}>;
