export const HISTORY: { file: string; sha256: string; eligibleName?: string }[];
export function readIsolatedDrizzleReplay(root?: string): Map<string, string>;
export function listIsolatedHistory(root?: string): string[];
