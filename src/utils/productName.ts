export interface ProductNameLayout {
  text: string;
  lines: string[];
  className: 'normal' | 'long' | 'very-long';
  autoWrapped: boolean;
}

const BREAK_CHARS = new Set([' ', '　', '・', '／', '/', '｜', '|', '：', ':', '－', '-', '—']);
const OPENERS = new Set(['(', '（', '[', '［', '【', '「', '『']);
const CLOSERS = new Set([')', '）', ']', '］', '】', '」', '』']);

/**
 * 商品名を「意味の切れ目」に寄せて最大2行へ整える。
 * 手入力の改行は最優先で保持し、自動整形では括弧の途中を避ける。
 */
export function layoutProductName(value: string, softLimit = 24): ProductNameLayout {
  const normalized = value.replace(/\r/g, '').trim();
  const manual = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (manual.length > 1) {
    const lines = manual.slice(0, 2);
    return { text: normalized, lines, className: classForLength(normalized.length), autoWrapped: false };
  }
  if (normalized.length <= softLimit) return { text: normalized, lines: [normalized], className: classForLength(normalized.length), autoWrapped: false };

  const candidates: number[] = [];
  let depth = 0;
  for (let i = 0; i < normalized.length - 1; i++) {
    const ch = normalized[i] ?? '';
    if (OPENERS.has(ch)) depth++;
    if (CLOSERS.has(ch)) depth = Math.max(0, depth - 1);
    if (depth !== 0) continue;
    if (BREAK_CHARS.has(ch) || CLOSERS.has(ch)) candidates.push(i + 1);
  }
  // 容量・入数・規格の直前も比較的自然な切れ目として扱う。
  for (const match of normalized.matchAll(/(?=\d+(?:\.\d+)?\s*(?:mL|ml|L|g|kg|枚|個|本|巻|ロール|箱|袋|双|組))/gi)) {
    if (typeof match.index === 'number' && match.index > 0) candidates.push(match.index);
  }
  const target = normalized.length / 2;
  const valid = [...new Set(candidates)].filter((index) => index >= 5 && normalized.length - index >= 5);
  if (!valid.length) return { text: normalized, lines: [normalized], className: classForLength(normalized.length), autoWrapped: false };
  const split = valid.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0] ?? valid[0] ?? normalized.length;
  let left = normalized.slice(0, split).trimEnd();
  let right = normalized.slice(split).trimStart();
  // Whitespace is only a visual separator and can be removed at a line break.
  // Punctuation such as ／・－ is part of the product name and is intentionally preserved.
  if (left.endsWith(' ') || left.endsWith('　')) left = left.trimEnd();
  right = right.trimStart();
  if (!left || !right) return { text: normalized, lines: [normalized], className: classForLength(normalized.length), autoWrapped: false };
  return { text: normalized, lines: [left, right], className: classForLength(normalized.length), autoWrapped: true };
}

function classForLength(length: number): 'normal' | 'long' | 'very-long' {
  if (length >= 42) return 'very-long';
  if (length >= 26) return 'long';
  return 'normal';
}
