/** Read only the SONNER-LEGACY block, independently of checkout line endings. */
export function sonnerLegacyPaths(config: string): string[] {
  const normalized = config.replace(/\r\n?/g, "\n");
  const marker = normalized.indexOf("SONNER-LEGACY");
  if (marker < 0) throw new Error("marker SONNER-LEGACY no encontrado en eslint.config.js");
  const blockEnd = normalized.indexOf("\n    },\n", marker);
  if (blockEnd < 0) throw new Error("fin del bloque SONNER-LEGACY no encontrado en eslint.config.js");
  const block = normalized.slice(marker, blockEnd);
  return [...block.matchAll(/"(src\/[^"*]+)"/g)].map((match) => match[1]);
}
