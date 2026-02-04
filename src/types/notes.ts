import type { UUID, Timestamp } from './project';

// ============================================
// NOTE TYPES
// ============================================

export type NoteSource = 'brief' | 'ai' | 'user';

export interface Note {
  id: UUID;
  source: NoteSource;
  content: string;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  // Optional: reason for the note (e.g., why a group was split)
  reason?: string;
}

// ============================================
// NOTE COLLECTIONS
// ============================================

export interface NoteCollection {
  notes: Note[];
}

// ============================================
// NOTE INPUTS
// ============================================

export interface CreateNoteInput {
  source: NoteSource;
  content: string;
  reason?: string;
}

export interface UpdateNoteInput {
  content?: string;
  reason?: string;
}
