import { useState, useRef, useLayoutEffect, useMemo, memo } from "react";
import {
  shrinkwrapWidth,
  measureTextWidth,
  getFontShorthand,
  measureLineHeight,
  takeWordsThatFit,
  getRenderPrecisionSlackPx,
} from "../../utils/textMeasurement";
import type { MessageRowProps, LineSegment } from "../../types/messaging";

function calculateOptimalWidth(
  containerWidth: number,
  contentRect: DOMRect,
  horizontalInsets: number,
  content: string,
  words: string[],
  headerMinTextWidth: number,
  fontOptions: { fontSize: string; fontFamily: string; lineHeight?: string },
): number {
  const MIN_TEXT_WIDTH = 40;
  const maxBubbleWidth = containerWidth > 0
    ? Math.max(1, Math.floor(containerWidth * 0.8) - 8)
    : Math.max(1, Math.floor(contentRect.width));

  const safeInsets = Math.max(0, Math.floor(horizontalInsets));
  const maxTextWidth = Math.max(1, Math.floor(maxBubbleWidth - safeInsets));
  const minTextWidth = Math.max(1, Math.min(maxTextWidth, MIN_TEXT_WIDTH));

  const shrinkwrappedWidth = shrinkwrapWidth(
    content,
    getFontShorthand(fontOptions),
    maxTextWidth,
    minTextWidth,
  );

  const longestWordWidth = words.reduce((max, word) => {
    return Math.max(max, measureTextWidth(word, fontOptions));
  }, 0);

  const minWholeWordWidth = Math.min(
    maxTextWidth,
    Math.ceil(longestWordWidth + getRenderPrecisionSlackPx()),
  );

  const headerFloorWidth = Math.min(
    maxTextWidth,
    Math.ceil(Math.max(0, headerMinTextWidth) + getRenderPrecisionSlackPx()),
  );

  // Keep bubble tight (Pretext shrinkwrap) but never narrower than header or longest whole word.
  const optimalTextWidth = Math.max(shrinkwrappedWidth, minWholeWordWidth, headerFloorWidth);
  return Math.min(maxBubbleWidth, Math.ceil(optimalTextWidth + safeInsets));
}

function calculateGeometry(
  containerRect: DOMRect,
  textRect: DOMRect,
  ballPosition: { x: number; y: number },
  logoSize: number,
) {
  const contentLeft = textRect.left - containerRect.left;

  return {
    ballRect: {
      left: ballPosition.x - contentLeft,
      top: ballPosition.y - (textRect.top - containerRect.top),
      width: logoSize,
      height: logoSize,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getLineCircleHole(
  ballRect: { left: number; top: number; width: number; height: number },
  lineTop: number,
  lineBottom: number,
  lineWidth: number,
) {
  const radius = Math.max(0, Math.min(ballRect.width, ballRect.height) / 2);
  if (radius <= 0) {
    return { holeLeft: 0, holeRight: 0, gapWidth: 0 };
  }

  const centerX = ballRect.left + ballRect.width / 2;
  const centerY = ballRect.top + ballRect.height / 2;
  const closestY = clamp(centerY, lineTop, lineBottom);
  const dy = Math.abs(closestY - centerY);

  if (dy >= radius) {
    return { holeLeft: 0, holeRight: 0, gapWidth: 0 };
  }

  const halfWidth = Math.sqrt(radius * radius - dy * dy);
  const holeLeft = clamp(Math.floor(centerX - halfWidth), 0, lineWidth);
  const holeRight = clamp(Math.ceil(centerX + halfWidth), 0, lineWidth);
  return {
    holeLeft,
    holeRight,
    gapWidth: Math.max(0, holeRight - holeLeft),
  };
}

function circleIntersectsRect(
  ballRect: { left: number; top: number; width: number; height: number },
  rectLeft: number,
  rectTop: number,
  rectWidth: number,
  rectHeight: number,
): boolean {
  const radius = Math.max(0, Math.min(ballRect.width, ballRect.height) / 2);
  if (radius <= 0) return false;

  const centerX = ballRect.left + ballRect.width / 2;
  const centerY = ballRect.top + ballRect.height / 2;

  const nearestX = clamp(centerX, rectLeft, rectLeft + rectWidth);
  const nearestY = clamp(centerY, rectTop, rectTop + rectHeight);
  const dx = centerX - nearestX;
  const dy = centerY - nearestY;

  return dx * dx + dy * dy < radius * radius;
}

function calculateWrappedLines(
  words: string[],
  contentWidth: number,
  lineHeight: number,
  fontOptions: { fontSize: string; fontFamily: string; lineHeight?: string },
  ballRect: { left: number; top: number; width: number; height: number },
  logoOverlapsMessage: boolean,
): LineSegment[] {
  const nextLines: LineSegment[] = [];
  let lineIndex = 0;
  let remaining = [...words];
  const lineWidth = Math.max(1, Math.floor(contentWidth));

  const withPrecisionSlack = (width: number) =>
    Math.max(1, width - getRenderPrecisionSlackPx());

  while (remaining.length > 0) {
    const lineTop = lineIndex * lineHeight;
    const lineBottom = lineTop + lineHeight;
    const { holeLeft, holeRight, gapWidth } = getLineCircleHole(
      ballRect,
      lineTop,
      lineBottom,
      lineWidth,
    );

    if (logoOverlapsMessage && gapWidth > 0) {
      const leftWidth = holeLeft;
      const rightStart = holeRight;
      const rightWidth = Math.max(0, lineWidth - rightStart);

      if (gapWidth <= 0) {
        const fullFit = takeWordsThatFit(remaining, withPrecisionSlack(lineWidth), fontOptions, true);
        if (!fullFit.text) {
          const forcedWord = remaining[0];
          if (forcedWord) {
            nextLines.push({ left: forcedWord, gap: false });
            remaining = remaining.slice(1);
          }
          lineIndex += 1;
          continue;
        }
        nextLines.push({ left: fullFit.text, gap: false });
        remaining = fullFit.remaining;
        lineIndex += 1;
        continue;
      }

      let leftText = "";
      let rightText = "";
      let consumedInThisLine = false;

      if (leftWidth > 20) {
        const leftFit = takeWordsThatFit(remaining, withPrecisionSlack(leftWidth), fontOptions, false);
        leftText = leftFit.text;
        consumedInThisLine = consumedInThisLine || leftFit.text.length > 0;
        remaining = leftFit.remaining;
      }

      if (remaining.length > 0) {
        // Same rule for right segment: no dash split based on overlay span width.
        const rightFit = takeWordsThatFit(remaining, withPrecisionSlack(rightWidth), fontOptions, false);
        rightText = rightFit.text;
        consumedInThisLine = consumedInThisLine || rightFit.text.length > 0;
        remaining = rightFit.remaining;
      }

      if (!consumedInThisLine) {
        nextLines.push({ left: "", right: "", gap: true, leftWidth, gapWidth, rightWidth });
        lineIndex += 1;
        continue;
      }

      nextLines.push({
        left: leftText,
        right: rightText,
        gap: true,
        leftWidth,
        gapWidth,
        rightWidth,
      });
    } else {
      const fullFit = takeWordsThatFit(remaining, withPrecisionSlack(lineWidth), fontOptions, true);
      if (!fullFit.text) {
        const forcedWord = remaining[0];
        if (forcedWord) {
          nextLines.push({ left: forcedWord, gap: false });
          remaining = remaining.slice(1);
        }
        lineIndex += 1;
        continue;
      }
      nextLines.push({ left: fullFit.text, gap: false });
      remaining = fullFit.remaining;
    }

    lineIndex += 1;
  }

  return nextLines;
}

function MessageRow({ index, style, data }: MessageRowProps) {
  const msg = data.messages[index];
  const isOwn = msg.from === data.clientId;
  const contentRef = useRef<HTMLDivElement>(null);
  const messageContentRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<LineSegment[]>([]);
  const [wrapWidth, setWrapWidth] = useState<number | null>(null);
  const lastMeasuredHeightRef = useRef<number>(0);
  const fontOptions = useMemo(
    () => ({
      fontSize: "14px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      lineHeight: "1.4",
    }),
    []
  );
  const lineHeightPx = useMemo(() => measureLineHeight(fontOptions), [fontOptions]);
  const headerFontOptions = useMemo(
    () => ({
      fontSize: "11px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      lineHeight: "1.3",
    }),
    []
  );

  useLayoutEffect(() => {
    if (!contentRef.current || !messageContentRef.current || !data.containerRef?.current) {
      return;
    }

    const containerRect = data.containerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const textRect = messageContentRef.current.getBoundingClientRect();
    const horizontalInsets = Math.max(0, Math.ceil(contentRect.width - textRect.width));
    const words = msg.content.split(/\s+/).filter(Boolean);
    const senderLabel = isOwn ? "You" : msg.from;
    const timeLabel = new Date(msg.timestamp).toLocaleTimeString();
    const headerGapPx = 8;
    const headerMinTextWidth =
      measureTextWidth(senderLabel, headerFontOptions) +
      measureTextWidth(timeLabel, headerFontOptions) +
      headerGapPx;

    // Calculate optimal bubble width
    const bubbleWidth = calculateOptimalWidth(
      data.containerWidth,
      contentRect,
      horizontalInsets,
      msg.content,
      words,
      headerMinTextWidth,
      fontOptions,
    );

    if (wrapWidth !== bubbleWidth) {
      setWrapWidth(bubbleWidth);
      return;
    }

    // Use actual rendered width (after max-width clamping) to avoid optimistic fit checks.
    const textWidth = Math.max(1, Math.floor(messageContentRef.current.clientWidth));

    // Calculate geometry (content position and ball rectangle)
    const { ballRect } = calculateGeometry(
      containerRect,
      textRect,
      data.ballPosition,
      data.logoSize,
    );

    // Check if logo overlaps the entire message
    const logoOverlapsMessage = circleIntersectsRect(
      ballRect,
      0,
      0,
      textWidth,
      Math.ceil(textRect.height),
    );

    // Calculate wrapped lines with object avoidance
    const lineHeight = measureLineHeight(fontOptions);
    const wrappedLines = calculateWrappedLines(
      words,
      textWidth,
      lineHeight,
      fontOptions,
      ballRect,
      logoOverlapsMessage,
    );

    setLines(wrappedLines);
  }, [msg.content, msg.from, msg.timestamp, index, isOwn, data.containerWidth, wrapWidth, data.ballPosition, data.logoSize, fontOptions, headerFontOptions, data.containerRef]);

  useLayoutEffect(() => {
    if (!contentRef.current) return;

    let measuredRowHeight = Math.ceil(contentRef.current.getBoundingClientRect().height);
    measuredRowHeight += 12;

    if (Math.abs(measuredRowHeight - lastMeasuredHeightRef.current) < 1) {
      return;
    }

    lastMeasuredHeightRef.current = measuredRowHeight;
    data.sizeMapRef.current[index] = measuredRowHeight;

    if (data.listRef?.current) {
      data.listRef.current.resetAfterIndex(index, false);
    }
  }, [lines, wrapWidth, index, data]);

  return (
    <div
      style={{
        ...style,
        display: "flex",
        flexDirection: isOwn ? "row-reverse" : "row",
        alignItems: "flex-start",
        padding: "6px 12px",
        boxSizing: "border-box",
        gap: "8px",
      }}
    >
      <div
        ref={contentRef}
        className={`message ${isOwn ? "message-sent" : "message-received"}`}
        style={{
          maxWidth: "80%",
          width: wrapWidth ? `${wrapWidth}px` : undefined,
          minWidth: 0,
          position: "relative",
          display: "block",
          overflow: "hidden",
        }}
      >
        <div className="message-header">
          <span className="message-from">{isOwn ? "You" : msg.from}</span>
          <span className="message-time">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div
          ref={messageContentRef}
          className="message-content"
          style={{
            position: "relative",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {lines.map((line, lineIndex) => (
            <div
              key={`${msg.from}-${msg.timestamp}-${lineIndex}`}
              style={{
                display: "flex",
                width: "100%",
                minHeight: `${lineHeightPx}px`,
                lineHeight: `${lineHeightPx}px`,
                alignItems: "flex-start",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              {line.gap ? (
                <>
                  <span
                    style={{
                      flex: `0 0 ${Math.floor(Math.max(0, line.leftWidth ?? 0))}px`,
                      maxWidth: `${Math.floor(Math.max(0, line.leftWidth ?? 0))}px`,
                      minWidth: 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "clip",
                    }}
                  >
                    {line.left}
                  </span>
                  <span style={{ flex: `0 0 ${Math.floor(Math.max(0, line.gapWidth ?? 0))}px` }} />
                  <span
                    style={{
                      flex: `0 0 ${Math.floor(Math.max(0, line.rightWidth ?? 0))}px`,
                      maxWidth: `${Math.floor(Math.max(0, line.rightWidth ?? 0))}px`,
                      minWidth: 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "clip",
                    }}
                  >
                    {line.right}
                  </span>
                </>
              ) : (
                <span
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: 0,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "clip",
                  }}
                >
                  {line.left}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const MemoizedMessageRow = memo(MessageRow);
