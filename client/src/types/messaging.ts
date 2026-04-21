import type { DecryptedMessage } from "../hooks/useClient";

export interface MessagingPanelProps {
  messages: DecryptedMessage[];
  clientId: string;
  onSend: (message: string) => void;
  disabled: boolean;
}

export interface MessageRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: DecryptedMessage[];
    clientId: string;
    listRef: any;
    sizeMapRef: React.RefObject<{ [key: number]: number }>;
    ballPosition: { x: number; y: number };
    logoSize: number;
    containerWidth: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
  };
}

export type LineSegment = {
  left: string;
  right?: string;
  gap: boolean;
  leftWidth?: number;
  gapWidth?: number;
  rightWidth?: number;
};

export type FontOptions = {
  fontSize: string;
  fontFamily: string;
  lineHeight?: string;
};