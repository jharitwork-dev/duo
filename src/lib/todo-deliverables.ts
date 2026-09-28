const ITEM_LINE = /^\s*[-•✓]\s+(.+)$/;

/**
 * "สิ่งที่ต้องส่ง" has no schema field: teachers write deliverables as bullet lines
 * ("-", "•" or "✓" followed by a space) in the to-do notes. Everything else stays in `rest`.
 */
export function parseDeliverables(notes: string | null): { items: string[]; rest: string } {
  if (!notes) return { items: [], rest: '' };

  const items: string[] = [];
  const restLines: string[] = [];
  for (const line of notes.split(/\r?\n/)) {
    const match = ITEM_LINE.exec(line);
    if (match) {
      const text = match[1].trim();
      if (text) items.push(text);
    } else if (/^\s*[-•✓]\s*$/.test(line)) {
      // Marker with no text — drop it.
    } else {
      restLines.push(line.trimEnd());
    }
  }

  const rest = restLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { items, rest };
}
