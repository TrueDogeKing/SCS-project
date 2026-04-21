import { measureLineStats, prepareWithSegments } from "@chenglou/pretext";
import type { FontOptions } from "../types/messaging";

const canvasCtx =
  typeof document !== "undefined"
    ? document.createElement("canvas").getContext("2d")
    : null;

/**
 * Tiny device-aware epsilon for sub-pixel layout precision.
 * This is not a static safety margin; it only compensates for fractional pixel rounding.
 */
export function getRenderPrecisionSlackPx(): number {
  const dpr =
    typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
      ? window.devicePixelRatio
      : 1;

  return 1 / Math.max(1, dpr);
}

// LRU Cache for prepared text (maps: "text||font" -> prepared)
const prepareCache = new Map<string, any>();
const MAX_PREPARE_CACHE_SIZE = 128;

/**
 * Get or create a PreparedTextWithSegments, with LRU caching.
 * Reuse prepared text across multiple measurements to avoid redundant Pretext work.
 */
export function getPreparedTextCached(text: string, font: string): any {
  const key = `${text}||${font}`;
  
  if (prepareCache.has(key)) {
    return prepareCache.get(key)!;
  }

  const prepared = prepareWithSegments(text || " ", font);
  
  // LRU eviction: keep cache bounded
  if (prepareCache.size >= MAX_PREPARE_CACHE_SIZE) {
    const firstKey = prepareCache.keys().next().value;
    if (firstKey !== undefined) {
      prepareCache.delete(firstKey);
    }
  }
  
  prepareCache.set(key, prepared);
  return prepared;
}

/**
 * Clear the prepare cache (useful when fonts change or memory is tight).
 */
export function clearPrepareCache(): void {
  prepareCache.clear();
}

/**
 * Binary-search shrinkwrap: finds the narrowest width that preserves line count.
 * If text fits on N lines at maxWidth, shrinkwrapWidth finds the smallest width
 * that still fits on N lines (or returns minWidth if narrower is impossible).
 */
export function shrinkwrapWidth(
  text: string,
  font: string,
  maxWidth: number,
  minWidth: number,
): number {
  const safeMax = Math.max(1, Math.floor(maxWidth));
  const safeMin = Math.max(1, Math.min(Math.floor(minWidth), safeMax));
  const prepared = getPreparedTextCached(text, font);
  const base = measureLineStats(prepared, safeMax);
  const targetLineCount = base.lineCount;

  let low = safeMin;
  let high = safeMax;
  let best = safeMax;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const stats = measureLineStats(prepared, mid);

    if (stats.lineCount <= targetLineCount) {
      best = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return best;
}

/**
 * Measure text width using canvas context, or estimate based on length.
 */
export function measureTextWidth(
  text: string,
  options: FontOptions,
): number {
  if (canvasCtx) {
    canvasCtx.font = `${options.fontSize} ${options.fontFamily}`;
    const metrics = canvasCtx.measureText(text);
    const advanceWidth = metrics.width;

    // Use the larger value so spacing advances and overhanging glyphs are both respected.
    if (
      Number.isFinite(metrics.actualBoundingBoxLeft) &&
      Number.isFinite(metrics.actualBoundingBoxRight)
    ) {
      const inkWidth =
        Math.abs(metrics.actualBoundingBoxLeft) +
        Math.abs(metrics.actualBoundingBoxRight);
      return Math.max(advanceWidth, inkWidth);
    }

    return advanceWidth;
  }

  return text.length * 8;
}

/**
 * Batch measure multiple words at once (more efficient than calling measureTextWidth per word).
 * Returns a map of word -> width.
 */
export function measureWordsWidths(
  words: string[],
  options: FontOptions,
): Map<string, number> {
  const widths = new Map<string, number>();
  if (!canvasCtx) {
    for (const word of words) {
      widths.set(word, word.length * 8);
    }
    return widths;
  }

  canvasCtx.font = `${options.fontSize} ${options.fontFamily}`;
  for (const word of words) {
    widths.set(word, canvasCtx.measureText(word).width);
  }
  return widths;
}

/**
 * Build font shorthand string from font options (fontSize + fontFamily).
 */
export function getFontShorthand(options: FontOptions): string {
  return `${options.fontSize} ${options.fontFamily}`;
}

/**
 * Check if text fits on a single line at the given width.
 */
export function fitsSingleLine(
  text: string,
  width: number,
  options: FontOptions,
): boolean {
  if (!text) return true;
  const safeWidth = Math.max(1, Math.floor(width - getRenderPrecisionSlackPx()));
  const requiredWidth = Math.ceil(measureTextWidth(text, options));
  return requiredWidth <= safeWidth;
}

/**
 * Calculate effective line height from font options.
 * Handles unitless multipliers (e.g., 1.4) and pixel values (e.g., "20px").
 */
export function measureLineHeight(options: FontOptions): number {
  const numericFont = parseFloat(options.fontSize);
  const fallbackFontSize = Number.isNaN(numericFont) ? 14 : numericFont;

  if (!options.lineHeight) {
    return fallbackFontSize * 1.4;
  }

  const raw = options.lineHeight.trim();
  if (raw.endsWith("px")) {
    const px = parseFloat(raw);
    return Number.isNaN(px) ? fallbackFontSize * 1.4 : px;
  }

  const value = parseFloat(raw);
  if (Number.isNaN(value)) {
    return fallbackFontSize * 1.4;
  }

  // Unitless values represent a multiplier (e.g. 1.4), absolute values are treated as px.
  return value <= 4 ? fallbackFontSize * value : value;
}

/**
 * Binary search to find the maximum number of characters from a word that fit on one line.
 * Returns the split point where we should break the word.
 * If the whole word fits (or even just 1 char), returns the full word length.
 */
export function findHyphenBreakPoint(
  word: string,
  width: number,
  options: FontOptions,
): number {
  if (word.length <= 1) return word.length;

  // For word breaking, use actual width without adaptive layout safety margin.
  const safeWidth = width;
  
  // Single char always fits (or we'd have no progress)
  if (measureTextWidth(word.charAt(0), options) > safeWidth) {
    return 1; // Force at least 1 character
  }

  let low = 1;
  let high = word.length;
  let bestFit = 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = word.substring(0, mid);
    const width_ = measureTextWidth(candidate, options);

    if (width_ <= safeWidth) {
      bestFit = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return bestFit;
}

/**
 * Break a long word into two parts for hyphenation: the part that fits with a hyphen,
 * and the remaining part to continue on the next line.
 * Returns null if the whole word fits on one line.
 * Only breaks if word is actually longer than container (edge case for very long words).
 */
export function breakWordForHyphenation(
  word: string,
  width: number,
  options: FontOptions,
): { part1: string; part2: string } | null {
  // Check if word fits at full width (no safety margin for hyphenation decision)
  const wordWidth = measureTextWidth(word, options);
  if (wordWidth <= width) {
    return null; // Whole word fits, no break needed
  }

  // Only apply hyphenation for truly long words (edge case).
  // Don't apply layout fit safety here; this is word-breaking logic.

  const breakPoint = findHyphenBreakPoint(word, width, options);
  
  if (breakPoint >= word.length) {
    return null; // Word fits (shouldn't happen)
  }

  if (breakPoint === 0) {
    // Extreme case: even 1 char doesn't fit. Force break after first char anyway.
    return {
      part1: word.charAt(0) + "-",
      part2: word.substring(1),
    };
  }

  return {
    part1: word.substring(0, breakPoint) + "-",
    part2: word.substring(breakPoint),
  };
}

/**
 * Greedily fit as many words as possible on one line.
 * If a word doesn't fit, move it to the next line (don't break it with hyphen).
 * Hyphenation only happens as absolute last resort if word is longer than container itself.
 * Returns the fitted text and remaining words.
 */
export function takeWordsThatFit(
  words: string[],
  width: number,
  options: FontOptions,
  allowOverflowFirstWord = false,
): { text: string; remaining: string[] } {
  if (words.length === 0) return { text: "", remaining: [] };

  const remaining = [...words];
  const firstWord = remaining.shift()!;

  // Check if first word fits entirely on the line
  if (!fitsSingleLine(firstWord, width, options)) {
    // Word doesn't fit - move it to next line (relocation), don't break it
    // Only break as absolute last resort if word is longer than the container itself
    const wordWidth = measureTextWidth(firstWord, options);
    
    if (wordWidth > width && allowOverflowFirstWord) {
      // Extreme edge case: word is longer than container AND we must fit something
      // Only then use hyphenation
      const broken = breakWordForHyphenation(firstWord, width, options);
      if (broken) {
        return { text: broken.part1, remaining: [broken.part2, ...remaining] };
      }
    }

    // Normal case: word doesn't fit, so move it to next line
    return { text: "", remaining: [firstWord, ...remaining] };
  }

  // First word fits entirely
  let text = firstWord;

  // Try to add more words on the same line
  while (remaining.length > 0) {
    const nextWord = remaining[0];
    const candidate = `${text} ${nextWord}`;
    
    if (fitsSingleLine(candidate, width, options)) {
      // Whole next word fits
      text = candidate;
      remaining.shift();
    } else {
      // Hyphenate only when the word itself is longer than a full line.
      // If it can fit on a new line, we move it to the next line unchanged.
      const fullWordWidth = measureTextWidth(nextWord, options);
      if (fullWordWidth > width) {
        const spacedText = text + " ";
        const remainingWidth = width - measureTextWidth(spacedText, options);
        const broken = breakWordForHyphenation(nextWord, remainingWidth, options);

        if (broken && fitsSingleLine(spacedText + broken.part1, width, options)) {
          // The broken part fits on this line
          text = spacedText + broken.part1;
          remaining[0] = broken.part2;
        }
      }

      break; // Can't fit any more complete words
    }
  }

  return { text, remaining };
}
