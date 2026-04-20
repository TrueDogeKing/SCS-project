import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { VariableSizeList as List } from "react-window";
import { measureLineStats, prepareWithSegments } from "@chenglou/pretext";
import type { DecryptedMessage } from "../hooks/useClient";

interface MessagingPanelProps {
  messages: DecryptedMessage[];
  clientId: string;
  onSend: (message: string) => void;
  disabled: boolean;
}

interface MessageRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: DecryptedMessage[];
    clientId: string;
    listRef: any;
    sizeMapRef: React.RefObject<{ [key: number]: number }>;
    ballPosition: { x: number; y: number };
    logoSize: number;
    logoGap: number;
    containerWidth: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
  };
}

type LineSegment = {
  left: string;
  right?: string;
  gap: boolean;
  leftWidth?: number;
  gapWidth?: number;
  rightWidth?: number;
};

const canvasCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
const FIT_SAFETY_PX = 60;

function shrinkwrapWidth(
  text: string,
  font: string,
  maxWidth: number,
  minWidth: number,
) {
  const safeMax = Math.max(1, Math.floor(maxWidth));
  const safeMin = Math.max(1, Math.min(Math.floor(minWidth), safeMax));
  const prepared = prepareWithSegments(text || " ", font);
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

function measureTextWidth(text: string, options: { fontSize: string; fontFamily: string; lineHeight?: string }) {
  if (canvasCtx) {
    canvasCtx.font = `${options.fontSize} ${options.fontFamily}`;
    return canvasCtx.measureText(text).width;
  }

  return text.length * 8;
}

function getFontShorthand(options: { fontSize: string; fontFamily: string; lineHeight?: string }) {
  return `${options.fontSize} ${options.fontFamily}`;
}

function fitsSingleLine(text: string, width: number, options: { fontSize: string; fontFamily: string; lineHeight?: string }) {
  if (!text) return true;
  const safeWidth = Math.max(1, Math.floor(width - FIT_SAFETY_PX));
  const prepared = prepareWithSegments(text, getFontShorthand(options));
  const stats = measureLineStats(prepared, safeWidth);
  return stats.lineCount <= 1;
}

function measureLineHeight(options: { fontSize: string; fontFamily: string; lineHeight?: string }) {
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

function takeWordsThatFit(
  words: string[],
  width: number,
  options: { fontSize: string; fontFamily: string; lineHeight?: string },
  allowOverflowFirstWord = false,
) {
  if (words.length === 0) return { text: "", remaining: [] as string[] };

  const remaining = [...words];
  const firstWord = remaining.shift()!;

  if (!fitsSingleLine(firstWord, width, options)) {
    if (allowOverflowFirstWord) {
      return { text: firstWord, remaining };
    }
    return { text: "", remaining: [firstWord, ...remaining] };
  }

  let text = firstWord;

  while (remaining.length > 0) {
    const candidate = `${text} ${remaining[0]}`;
    if (fitsSingleLine(candidate, width, options)) {
      text = candidate;
      remaining.shift();
    } else {
      break;
    }
  }

  return { text, remaining };
}

// ============================================================================
// Helper Functions for Text Layout
// ============================================================================

function calculateOptimalWidth(
  containerWidth: number,
  contentRect: DOMRect,
  content: string,
  words: string[],
  fontOptions: { fontSize: string; fontFamily: string; lineHeight?: string },
): number {
  const DEFAULT_MIN = 220;
  const maxBubbleWidth = containerWidth > 0
    ? Math.max(DEFAULT_MIN, Math.floor(containerWidth * 0.8) - 8)
    : Math.max(DEFAULT_MIN, Math.floor(contentRect.width));

  const shrinkwrappedWidth = shrinkwrapWidth(
    content,
    getFontShorthand(fontOptions),
    maxBubbleWidth,
    DEFAULT_MIN,
  );

  const longestWordWidth = words.reduce((max, word) => {
    return Math.max(max, measureTextWidth(word, fontOptions));
  }, 0);

  const minWholeWordWidth = Math.min(
    maxBubbleWidth,
    Math.ceil(longestWordWidth + FIT_SAFETY_PX),
  );

  return Math.max(shrinkwrappedWidth, minWholeWordWidth);
}

function calculateGeometry(
  containerRect: DOMRect,
  textRect: DOMRect,
  ballPosition: { x: number; y: number },
  logoSize: number,
) {
  const contentLeft = textRect.left - containerRect.left;
  const contentTop = textRect.top - containerRect.top;

  return {
    contentLeft,
    contentTop,
    ballRect: {
      left: ballPosition.x - contentLeft,
      top: ballPosition.y - contentTop,
      width: logoSize,
      height: logoSize,
    },
  };
}

function calculateWrappedLines(
  words: string[],
  contentWidth: number,
  lineHeight: number,
  fontOptions: { fontSize: string; fontFamily: string; lineHeight?: string },
  ballRect: { left: number; top: number; width: number; height: number },
  logoOverlapsMessage: boolean,
  logoGap: number,
): LineSegment[] {
  const nextLines: LineSegment[] = [];
  let lineIndex = 0;
  let remaining = [...words];

  while (remaining.length > 0) {
    const lineTop = lineIndex * lineHeight;
    const lineBottom = lineTop + lineHeight;
    const overlapsLine = ballRect.top < lineBottom && ballRect.top + ballRect.height > lineTop;

    if (logoOverlapsMessage && overlapsLine) {
      const holeLeft = Math.max(0, ballRect.left - logoGap);
      const holeRight = Math.min(contentWidth, ballRect.left + ballRect.width + logoGap);
      const gapWidth = Math.max(0, holeRight - holeLeft);
      const leftWidth = holeLeft;
      const rightStart = holeRight;
      const rightWidth = Math.max(0, contentWidth - rightStart);

      if (gapWidth <= 0) {
        const fullFit = takeWordsThatFit(remaining, contentWidth, fontOptions);
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
        const leftFit = takeWordsThatFit(remaining, leftWidth, fontOptions);
        leftText = leftFit.text;
        consumedInThisLine = consumedInThisLine || leftFit.text.length > 0;
        remaining = leftFit.remaining;
      }

      if (remaining.length > 0) {
        const rightFit = takeWordsThatFit(remaining, rightWidth, fontOptions);
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
      const fullFit = takeWordsThatFit(remaining, contentWidth, fontOptions);
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
  const fontOptions = {
    fontSize: "14px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
    lineHeight: "1.4",
  };
  const lineHeightPx = measureLineHeight(fontOptions);

  useLayoutEffect(() => {
    if (!contentRef.current || !messageContentRef.current || !data.containerRef?.current) {
      return;
    }

    const containerRect = data.containerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const textRect = messageContentRef.current.getBoundingClientRect();
    const words = msg.content.split(/\s+/).filter(Boolean);

    // Calculate optimal bubble width
    const contentWidth = calculateOptimalWidth(
      data.containerWidth,
      contentRect,
      msg.content,
      words,
      fontOptions,
    );

    if (wrapWidth !== contentWidth) {
      setWrapWidth(contentWidth);
    }

    // Calculate geometry (content position and ball rectangle)
    const { contentLeft, contentTop, ballRect } = calculateGeometry(
      containerRect,
      textRect,
      data.ballPosition,
      data.logoSize,
    );

    // Check if logo overlaps the entire message
    const logoOverlapsMessage =
      data.ballPosition.x < contentLeft + contentWidth &&
      data.ballPosition.x + data.logoSize > contentLeft &&
      data.ballPosition.y < contentTop + textRect.height &&
      data.ballPosition.y + data.logoSize > contentTop;

    // Calculate wrapped lines with object avoidance
    const lineHeight = measureLineHeight(fontOptions);
    const wrappedLines = calculateWrappedLines(
      words,
      contentWidth,
      lineHeight,
      fontOptions,
      ballRect,
      logoOverlapsMessage,
      data.logoGap,
    );

    setLines(wrappedLines);
  }, [msg.content, msg.from, msg.timestamp, index, data, data.ballPosition, data.containerWidth, wrapWidth]);

  useLayoutEffect(() => {
    if (!contentRef.current) return;

    const measuredBubbleHeight = Math.ceil(contentRef.current.getBoundingClientRect().height);
    const totalRowHeight = measuredBubbleHeight + 12; // row has 6px top + 6px bottom padding

    if (Math.abs(totalRowHeight - lastMeasuredHeightRef.current) < 1) {
      return;
    }

    lastMeasuredHeightRef.current = totalRowHeight;
    data.sizeMapRef.current[index] = totalRowHeight;

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
                      flex: `0 0 ${Math.max(0, line.leftWidth ?? 0)}px`,
                      maxWidth: `${Math.max(0, line.leftWidth ?? 0)}px`,
                      minWidth: 0,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "clip",
                    }}
                  >
                    {line.left}
                  </span>
                  <span style={{ flex: `0 0 ${Math.max(0, line.gapWidth ?? 0)}px` }} />
                  <span
                    style={{
                      flex: `0 0 ${Math.max(0, line.rightWidth ?? 0)}px`,
                      maxWidth: `${Math.max(0, line.rightWidth ?? 0)}px`,
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
                    flex: "0 0 100%",
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

export function MessagingPanel({
  messages,
  clientId,
  onSend,
  disabled,
}: MessagingPanelProps) {
  const [input, setInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 50 });
  const [logoSize, setLogoSize] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const listRef = useRef<List>(null);
  const sizeMapRef = useRef<{ [key: number]: number }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const logoGap = 20;
  const velocityRef = useRef({ x: 0.03, y: 0.02 }); // px/ms, intentionally slow

  useLayoutEffect(() => {
    const tickMs = 120;
    const intervalId = window.setInterval(() => {
      if (isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const maxX = Math.max(0, Math.floor(rect.width - logoSize));
      const maxY = Math.max(0, Math.floor(rect.height - logoSize));

      setBallPosition((prev) => {
        let nextX = prev.x + velocityRef.current.x * tickMs;
        let nextY = prev.y + velocityRef.current.y * tickMs;

        if (nextX <= 0 || nextX >= maxX) {
          velocityRef.current.x *= -1;
          nextX = Math.max(0, Math.min(nextX, maxX));
        }

        if (nextY <= 0 || nextY >= maxY) {
          velocityRef.current.y *= -1;
          nextY = Math.max(0, Math.min(nextY, maxY));
        }

        // Small random direction nudge to keep motion organic.
        if (Math.random() < 0.08) {
          velocityRef.current.x += (Math.random() - 0.5) * 0.01;
          velocityRef.current.y += (Math.random() - 0.5) * 0.01;
          velocityRef.current.x = Math.max(-0.06, Math.min(0.06, velocityRef.current.x));
          velocityRef.current.y = Math.max(-0.06, Math.min(0.06, velocityRef.current.y));
        }

        return { x: nextX, y: nextY };
      });
      if (listRef.current) {
        listRef.current.resetAfterIndex(0, false);
      }
    }, tickMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isDragging, logoSize]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const getItemSize = useCallback((index: number) => {
    return sizeMapRef.current[index] || 80;
  }, []);

  const handleBallMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - containerRect.left - ballPosition.x,
      y: e.clientY - containerRect.top - ballPosition.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    setBallPosition({
      x: e.clientX - containerRect.left - dragStart.x,
      y: e.clientY - containerRect.top - dragStart.y,
    });
    // Force re-measurement of visible messages
    if (listRef.current) {
      listRef.current.resetAfterIndex(0, true);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleLogoWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -4 : 4;
    setLogoSize((current) => {
      const next = Math.max(24, Math.min(120, current + delta));
      return next;
    });
  };

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    
    // Scroll to bottom after sending
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollToItem(messages.length - 1, "end");
      }
    }, 100);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className={`panel messaging-panel${isFullscreen ? " panel-fullscreen" : ""}`}>
      <div className="panel-header">
        <h3>Encrypted Messaging (AES-256-GCM)</h3>
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => setIsFullscreen((prev) => !prev)}
        >
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
      <p className="panel-desc">Messages delivered via websocket</p>

      <div
        ref={containerRef}
        className={`messages-container${isFullscreen ? " messages-container-fullscreen" : ""}`}
        style={{ position: "relative" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {messages.length === 0 ? (
          <div className="messages-empty">
            {disabled
              ? "Authenticate first to send messages"
              : "No messages yet — send one!"}
          </div>
        ) : (
          <>
            {/* Draggable bun logo */}
            <div
              onMouseDown={handleBallMouseDown}
              onWheel={handleLogoWheel}
              onDragStart={(e) => e.preventDefault()}
              style={{
                position: "absolute",
                left: `${ballPosition.x}px`,
                top: `${ballPosition.y}px`,
                width: `${logoSize}px`,
                height: `${logoSize}px`,
                borderRadius: "50%",
                overflow: "hidden",
                boxShadow: `0 2px 8px rgba(0, 0, 0, 0.2), ${isDragging ? "0 0 16px rgba(0, 0, 0, 0.35)" : ""}`,
                cursor: isDragging ? "grabbing" : "grab",
                zIndex: 1000,
                transition: isDragging ? "none" : "box-shadow 0.2s",
                pointerEvents: "auto",
              }}
              title="Drag to move. Scroll to resize."
            >
              <img
                src="/bun.svg"
                alt="Bun logo"
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "contain",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
            <List
              ref={listRef}
              height={isFullscreen ? window.innerHeight - 260 : 350}
              itemCount={messages.length}
              itemSize={getItemSize}
              width="100%"
              itemData={{
                messages,
                clientId,
                listRef,
                sizeMapRef,
                ballPosition,
                logoSize,
                logoGap,
                containerWidth,
                containerRef,
              }}
              overscanCount={3}
            >
              {MessageRow}
            </List>
          </>
        )}
      </div>

      <div className="message-input-row">
        <input
          type="text"
          placeholder={disabled ? "Authenticate first..." : "Type a message..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          className="btn-primary"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
