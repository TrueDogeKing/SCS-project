import { useState, useRef, useCallback, useLayoutEffect, useReducer } from "react";
import { VariableSizeList as List } from "react-window";
import type { MessagingPanelProps } from "../types/messaging";
import { MessageInput } from "./MessageInput";
import { ballReducer, initialBallState } from "./messaging/ballReducer";
import { MemoizedMessageRow } from "./messaging/MessageRow";

export function MessagingPanel({
  messages,
  clientId,
  onSend,
  disabled,
}: MessagingPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ballState, dispatchBall] = useReducer(ballReducer, initialBallState);
  const listRef = useRef<List>(null);
  const sizeMapRef = useRef<{ [key: number]: number }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const velocityRef = useRef({ x: 0.03, y: 0.02 });
  const ballAnimationRef = useRef({ x: 50, y: 50 }); // Keep animation state in ref
  const animationFrameRef = useRef<number | null>(null);

  const { position: ballPosition, logoSize, isDragging, dragStart } = ballState;

  // Animation loop using requestAnimationFrame - updates DOM directly, no React rerenders
  const updateBallAnimation = useCallback(() => {
    if (isDragging || !containerRef.current || !ballRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const maxX = Math.max(0, Math.floor(rect.width - logoSize));
    const maxY = Math.max(0, Math.floor(rect.height - logoSize));

    let nextX = ballAnimationRef.current.x + velocityRef.current.x;
    let nextY = ballAnimationRef.current.y + velocityRef.current.y;

    if (nextX <= 0 || nextX >= maxX) {
      velocityRef.current.x *= -1;
      nextX = Math.max(0, Math.min(nextX, maxX));
    }

    if (nextY <= 0 || nextY >= maxY) {
      velocityRef.current.y *= -1;
      nextY = Math.max(0, Math.min(nextY, maxY));
    }

    // Small random direction nudge
    if (Math.random() < 0.08) {
      velocityRef.current.x += (Math.random() - 0.5) * 0.01;
      velocityRef.current.y += (Math.random() - 0.5) * 0.01;
      velocityRef.current.x = Math.max(-0.06, Math.min(0.06, velocityRef.current.x));
      velocityRef.current.y = Math.max(-0.06, Math.min(0.06, velocityRef.current.y));
    }

    ballAnimationRef.current = { x: nextX, y: nextY };
    
    // Update DOM directly
    ballRef.current.style.left = `${nextX}px`;
    ballRef.current.style.top = `${nextY}px`;
    
    // Also update React state for message calculations (but less frequently)
    dispatchBall({ type: "animation-step", position: { x: nextX, y: nextY } });

    animationFrameRef.current = requestAnimationFrame(updateBallAnimation);
  }, [isDragging, logoSize]);

  useLayoutEffect(() => {
    if (isDragging) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      return;
    }

    animationFrameRef.current = requestAnimationFrame(updateBallAnimation);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDragging, updateBallAnimation]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(Math.floor(entry.contentRect.width));
      setContainerHeight(Math.floor(entry.contentRect.height));
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const getItemSize = useCallback((index: number) => {
    return sizeMapRef.current[index] || 80;
  }, []);

  const listHeight = containerHeight > 0 ? containerHeight : 350;

  const handleBallMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    dispatchBall({
      type: "start-drag",
      dragStart: {
        x: e.clientX - containerRect.left - ballAnimationRef.current.x,
        y: e.clientY - containerRect.top - ballAnimationRef.current.y,
      },
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragStart.x;
    const newY = e.clientY - containerRect.top - dragStart.y;
    
    ballAnimationRef.current = { x: newX, y: newY };
    dispatchBall({ type: "drag-move", position: { x: newX, y: newY } });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    dispatchBall({ type: "stop-drag" });
  }, []);

  useLayoutEffect(() => {
    const logoElement = ballRef.current;
    if (!logoElement) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const delta = event.deltaY > 0 ? -4 : 4;
      dispatchBall({ type: "resize-logo", delta });
    };

    logoElement.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      logoElement.removeEventListener("wheel", onWheel);
    };
  }, [messages.length]);

  const handleSend = useCallback((text: string) => {
    onSend(text);
  }, [onSend]);

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
            <div
              ref={ballRef}
              onMouseDown={handleBallMouseDown}
              onDragStart={(e) => e.preventDefault()}
              style={{
                position: "absolute",
                left: `${ballPosition.x}px`,
                top: `${ballPosition.y}px`,
                width: `${logoSize}px`,
                height: `${logoSize}px`,
                borderRadius: "50%",
                overflow: "hidden",
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
              height={listHeight}
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
                containerWidth,
                containerRef,
              }}
              overscanCount={3}
            >
              {MemoizedMessageRow}
            </List>
          </>
        )}
      </div>

      <MessageInput disabled={disabled} onSend={handleSend} />
    </div>
  );
}
