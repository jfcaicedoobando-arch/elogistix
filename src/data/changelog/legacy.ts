import type { ChangelogEntry } from "../changelogData";
import { changelogV7 } from "./v7";
import { changelogV6 } from "./v6";
import { changelogV5 } from "./v5";
import { changelogV4 } from "./v4";
import { changelogV3 } from "./v3";
import { changelogV2 } from "./v2";
import { changelogV1 } from "./v1";

/** Histórico completo (v7.x y anteriores) — agrega los archivos por major version. */
export const legacyChangelog: ChangelogEntry[] = [
  ...changelogV7,
  ...changelogV6,
  ...changelogV5,
  ...changelogV4,
  ...changelogV3,
  ...changelogV2,
  ...changelogV1,
];
