export type Point = { x: number; y: number };

export type BallState = {
  position: Point;
  isDragging: boolean;
  dragStart: Point;
  logoSize: number;
};

export type BallAction =
  | { type: "start-drag"; dragStart: Point }
  | { type: "drag-move"; position: Point }
  | { type: "stop-drag" }
  | { type: "animation-step"; position: Point }
  | { type: "resize-logo"; delta: number };

export const initialBallState: BallState = {
  position: { x: 50, y: 50 },
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  logoSize: 40,
};

export function ballReducer(state: BallState, action: BallAction): BallState {
  switch (action.type) {
    case "start-drag":
      return {
        ...state,
        isDragging: true,
        dragStart: action.dragStart,
      };

    case "drag-move":
      return {
        ...state,
        position: action.position,
      };

    case "stop-drag":
      if (!state.isDragging) return state;
      return {
        ...state,
        isDragging: false,
      };

    case "animation-step": {
      const dx = Math.abs(state.position.x - action.position.x);
      const dy = Math.abs(state.position.y - action.position.y);

      // Ignore tiny movement updates to avoid unnecessary re-renders.
      if (dx <= 1 && dy <= 1) {
        return state;
      }

      return {
        ...state,
        position: action.position,
      };
    }

    case "resize-logo": {
      const nextSize = Math.max(24, Math.min(120, state.logoSize + action.delta));
      if (nextSize === state.logoSize) return state;
      return {
        ...state,
        logoSize: nextSize,
      };
    }

    default:
      return state;
  }
}
