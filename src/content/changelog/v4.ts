import type { ChangelogEntry } from "../changelogData";
import { chunk0 } from "./v4/chunks/0";
import { chunk1 } from "./v4/chunks/1";
import { chunk2 } from "./v4/chunks/2";
import { chunk3 } from "./v4/chunks/3";

/**
 * V4 changelog: split into chunks of 25 entries
 * to keep each file manageable. Order is preserved (most recent first).
 */
export const changelogV4: ChangelogEntry[] = [
  ...chunk0,
  ...chunk1,
  ...chunk2,
  ...chunk3,
];
