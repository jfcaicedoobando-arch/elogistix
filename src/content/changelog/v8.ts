import type { ChangelogEntry } from "../changelogData";
import { chunk0 } from "./v8/chunks/0";
import { chunk1 } from "./v8/chunks/1";
import { chunk2 } from "./v8/chunks/2";
import { chunk3 } from "./v8/chunks/3";
import { chunk4 } from "./v8/chunks/4";
import { chunk5 } from "./v8/chunks/5";

/**
 * V8 changelog: split into chunks of 20 entries
 * to keep each file manageable. Order is preserved (most recent first).
 */
export const changelogV8: ChangelogEntry[] = [
  ...chunk0,
  ...chunk1,
  ...chunk2,
  ...chunk3,
  ...chunk4,
  ...chunk5,
];
