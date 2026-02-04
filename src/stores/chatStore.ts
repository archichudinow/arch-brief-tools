import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type {
  UUID,
  ChatMessage,
  UserMessage,
  AIMessage,
  SystemMessage,
  Proposal,
  ProposalStatus,
  ChatMode,
  AIRole,
} from '@/types';

// ============================================
// STATE INTERFACE
// ============================================

interface ChatState {
  // Messages
  messages: ChatMessage[];

  // Pending proposals
  pendingProposals: Proposal[];

  // Project context (generated from brief parsing)
  projectContext: string | null;

  // Chat configuration
  chatMode: ChatMode;
  aiRole: AIRole | null;

  // UI State
  isOpen: boolean;
  isLoading: boolean;
  inputValue: string;

  // Brief input mode
  briefMode: boolean;
  briefText: string;

  // Actions - Panel
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  setInputValue: (value: string) => void;

  // Actions - Chat Config
  setChatMode: (mode: ChatMode) => void;
  setAIRole: (role: AIRole | null) => void;

  // Actions - Brief Mode
  setBriefMode: (mode: boolean) => void;
  setBriefText: (text: string) => void;

  // Actions - Messages
  addUserMessage: (content: string, selectedNodeIds: UUID[], selectedGroupIds: UUID[]) => UUID;
  addAIMessage: (content: string, proposals?: Proposal[]) => UUID;
  addSystemMessage: (content: string, type: SystemMessage['type']) => UUID;
  updateAIMessageStatus: (id: UUID, status: AIMessage['status']) => void;
  appendToAIMessage: (id: UUID, content: string) => void;

  // Actions - Proposals
  acceptProposal: (proposalId: UUID) => Proposal | null;
  rejectProposal: (proposalId: UUID) => void;
  updateProposalStatus: (proposalId: UUID, status: ProposalStatus) => void;

  // Actions - Context
  setProjectContext: (context: string) => void;
  setLoading: (loading: boolean) => void;

  // Actions - Clear
  clearChat: () => void;
  clearProposals: () => void;
}

// ============================================
// HELPER
// ============================================

function now(): string {
  return new Date().toISOString();
}

// ============================================
// STORE
// ============================================

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    // Initial state
    messages: [],
    pendingProposals: [],
    projectContext: null,
    chatMode: 'agent' as ChatMode,
    aiRole: null,
    isOpen: false,
    isLoading: false,
    inputValue: '',
    briefMode: false,
    briefText: '',

    // Panel actions
    openChat: () => set((state) => { state.isOpen = true; }),
    closeChat: () => set((state) => { state.isOpen = false; }),
    toggleChat: () => set((state) => { state.isOpen = !state.isOpen; }),
    setInputValue: (value) => set((state) => { state.inputValue = value; }),

    // Chat config actions
    setChatMode: (mode) => set((state) => { state.chatMode = mode; }),
    setAIRole: (role) => set((state) => { state.aiRole = role; }),

    // Brief mode
    setBriefMode: (mode) => set((state) => { state.briefMode = mode; }),
    setBriefText: (text) => set((state) => { state.briefText = text; }),

    // Message actions
    addUserMessage: (content, selectedNodeIds, selectedGroupIds) => {
      const id = uuidv4();
      const message: UserMessage = {
        id,
        role: 'user',
        content,
        timestamp: now(),
        context: {
          selectedNodeIds,
          selectedGroupIds,
        },
      };
      set((state) => {
        state.messages.push(message);
        state.inputValue = '';
      });
      return id;
    },

    addAIMessage: (content, proposals) => {
      const id = uuidv4();
      const message: AIMessage = {
        id,
        role: 'assistant',
        content,
        timestamp: now(),
        proposals,
        status: 'complete',
      };
      set((state) => {
        state.messages.push(message);
        if (proposals) {
          state.pendingProposals.push(
            ...proposals.filter((p) => p.status === 'pending')
          );
        }
      });
      return id;
    },

    addSystemMessage: (content, type) => {
      const id = uuidv4();
      const message: SystemMessage = {
        id,
        role: 'system',
        content,
        timestamp: now(),
        type,
      };
      set((state) => {
        state.messages.push(message);
      });
      return id;
    },

    updateAIMessageStatus: (id, status) => set((state) => {
      const msg = state.messages.find((m) => m.id === id && m.role === 'assistant');
      if (msg && msg.role === 'assistant') {
        msg.status = status;
      }
    }),

    appendToAIMessage: (id, content) => set((state) => {
      const msg = state.messages.find((m) => m.id === id && m.role === 'assistant');
      if (msg && msg.role === 'assistant') {
        msg.content += content;
      }
    }),

    // Proposal actions
    acceptProposal: (proposalId) => {
      const state = get();
      const proposal = state.pendingProposals.find((p) => p.id === proposalId);
      if (!proposal) return null;

      set((s) => {
        const idx = s.pendingProposals.findIndex((p) => p.id === proposalId);
        if (idx !== -1) {
          s.pendingProposals[idx].status = 'accepted';
          s.pendingProposals.splice(idx, 1);
        }
        // Also update in messages
        s.messages.forEach((msg) => {
          if (msg.role === 'assistant' && msg.proposals) {
            const p = msg.proposals.find((pr) => pr.id === proposalId);
            if (p) p.status = 'accepted';
          }
        });
      });

      return proposal;
    },

    rejectProposal: (proposalId) => set((state) => {
      const idx = state.pendingProposals.findIndex((p) => p.id === proposalId);
      if (idx !== -1) {
        state.pendingProposals[idx].status = 'rejected';
        state.pendingProposals.splice(idx, 1);
      }
      // Also update in messages
      state.messages.forEach((msg) => {
        if (msg.role === 'assistant' && msg.proposals) {
          const p = msg.proposals.find((pr) => pr.id === proposalId);
          if (p) p.status = 'rejected';
        }
      });
    }),

    updateProposalStatus: (proposalId, status) => set((state) => {
      const proposal = state.pendingProposals.find((p) => p.id === proposalId);
      if (proposal) {
        proposal.status = status;
      }
    }),

    // Context
    setProjectContext: (context) => set((state) => {
      state.projectContext = context;
    }),

    setLoading: (loading) => set((state) => {
      state.isLoading = loading;
    }),

    // Clear
    clearChat: () => set((state) => {
      state.messages = [];
      state.pendingProposals = [];
      state.inputValue = '';
    }),

    clearProposals: () => set((state) => {
      state.pendingProposals = [];
    }),
  }))
);
