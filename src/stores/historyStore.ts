import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type { HistoryState, StateSnapshot, ActionType, SnapshotData } from '@/types';

// ============================================
// CONSTANTS
// ============================================

const MAX_SNAPSHOTS = 100;

// ============================================
// STATE INTERFACE
// ============================================

interface HistoryStore extends HistoryState {
  // Actions
  snapshot: (actionType: ActionType, label: string, data: SnapshotData) => void;
  undo: () => SnapshotData | null;
  redo: () => SnapshotData | null;
  reset: () => void;
  
  // Queries
  canUndo: () => boolean;
  canRedo: () => boolean;
  getCurrentSnapshot: () => StateSnapshot | null;
}

// ============================================
// STORE
// ============================================

export const useHistoryStore = create<HistoryStore>()(
  immer((set, get) => ({
    snapshots: [],
    currentIndex: -1,

    snapshot: (actionType, label, data) => {
      set((state) => {
        // If we're not at the end, discard future snapshots
        if (state.currentIndex < state.snapshots.length - 1) {
          state.snapshots = state.snapshots.slice(0, state.currentIndex + 1);
        }

        // Create deep copy of data
        const snapshotData: SnapshotData = JSON.parse(JSON.stringify(data));

        const newSnapshot: StateSnapshot = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          label,
          actionType,
          data: snapshotData,
        };

        state.snapshots.push(newSnapshot);
        state.currentIndex = state.snapshots.length - 1;

        // Trim old snapshots if exceeding limit
        if (state.snapshots.length > MAX_SNAPSHOTS) {
          const excess = state.snapshots.length - MAX_SNAPSHOTS;
          state.snapshots = state.snapshots.slice(excess);
          state.currentIndex = Math.max(0, state.currentIndex - excess);
        }
      });
    },

    undo: () => {
      const state = get();
      if (state.currentIndex <= 0) return null;

      set((s) => {
        s.currentIndex -= 1;
      });

      return get().snapshots[get().currentIndex]?.data ?? null;
    },

    redo: () => {
      const state = get();
      if (state.currentIndex >= state.snapshots.length - 1) return null;

      set((s) => {
        s.currentIndex += 1;
      });

      return get().snapshots[get().currentIndex]?.data ?? null;
    },

    reset: () => {
      set((state) => {
        state.snapshots = [];
        state.currentIndex = -1;
      });
    },

    canUndo: () => {
      return get().currentIndex > 0;
    },

    canRedo: () => {
      const state = get();
      return state.currentIndex < state.snapshots.length - 1;
    },

    getCurrentSnapshot: () => {
      const state = get();
      if (state.currentIndex < 0 || state.currentIndex >= state.snapshots.length) {
        return null;
      }
      return state.snapshots[state.currentIndex];
    },
  }))
);
