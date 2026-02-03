import { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, User, Bot, Sparkles, Square } from 'lucide-react';
import type { ChatMessage, ProgramItem, FunctionalGroup } from '@/types';
import { cn } from '@/lib/utils';

interface AttachedItem {
  type: 'program' | 'group';
  id: string;
  label: string;
}

interface ChatPanelProps {
  /** Chat mode - determines prompts and actions */
  mode: 'refine-brief' | 'regroup';
  /** Current chat messages */
  messages: ChatMessage[];
  /** Called when user sends a message */
  onSend: (message: string, attachedItems: AttachedItem[]) => Promise<void>;
  /** Called when user wants to stop/cancel the current request */
  onStop?: () => void;
  /** Whether AI is currently processing */
  isLoading?: boolean;
  /** Programs available for attachment */
  programs?: ProgramItem[];
  /** Groups available for attachment (for regroup mode) */
  groups?: FunctionalGroup[];
  /** Currently selected/attached items */
  selectedItems?: AttachedItem[];
  /** Callback to update selected items */
  onSelectItem?: (item: AttachedItem) => void;
  /** Callback to remove selected item */
  onRemoveItem?: (itemId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Collapsed state */
  collapsed?: boolean;
}

export function ChatPanel({
  mode,
  messages,
  onSend,
  onStop,
  isLoading = false,
  programs = [],
  groups = [],
  selectedItems = [],
  onSelectItem,
  onRemoveItem,
  placeholder,
  collapsed = false,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await onSend(message, selectedItems);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Show suggestions on @ mention
    if (e.key === '@') {
      setShowSuggestions(true);
    }
    // Hide on escape
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleAttach = (item: AttachedItem) => {
    onSelectItem?.(item);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const defaultPlaceholder = mode === 'refine-brief'
    ? 'Add rooms, modify areas, or ask questions...'
    : 'Ask to regroup rooms, merge clusters, or split groups...';

  if (collapsed) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur border border-border/50 rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {mode === 'refine-brief' ? 'Refine Brief' : 'Adjust Grouping'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[400px]">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <p className="mb-2">
              {mode === 'refine-brief'
                ? 'Ask me to add rooms, modify areas, or update notes.'
                : 'Ask me to regroup rooms, merge or split clusters.'}
            </p>
            <p className="text-xs">
              Tip: Select rooms below and drop them here for context.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.attachedItems && msg.attachedItems.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
                    {msg.attachedItems.map((item: string) => (
                      <span key={item} className="px-2 py-0.5 bg-secondary rounded text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Thinking...</span>
              {onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                    'bg-destructive/20 text-destructive hover:bg-destructive/30',
                    'transition-colors'
                  )}
                  title="Stop generation"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </button>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
          <div className="flex flex-wrap gap-1">
            {selectedItems.map((item) => (
              <span
                key={item.id}
                className="px-2 py-0.5 border border-border rounded text-xs flex items-center gap-1"
              >
                {item.label}
                <button
                  type="button"
                  onClick={() => onRemoveItem?.(item.id)}
                  className="hover:bg-destructive/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && (programs.length > 0 || groups.length > 0) && (
        <div className="absolute bottom-20 left-4 right-4 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
          {programs.length > 0 && (
            <div className="p-2">
              <p className="text-xs text-muted-foreground px-2 mb-1">Programs</p>
              {programs.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAttach({ type: 'program', id: p.id, label: p.name })}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded"
                >
                  {p.name} ({p.area}m²)
                </button>
              ))}
            </div>
          )}
          {mode === 'regroup' && groups.length > 0 && (
            <div className="p-2 border-t border-border">
              <p className="text-xs text-muted-foreground px-2 mb-1">Groups</p>
              {groups.slice(0, 5).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleAttach({ type: 'group', id: g.id, label: g.name })}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded"
                >
                  {g.name} ({g.programIds.length} rooms)
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowSuggestions(false)}
            className="w-full text-center px-3 py-2 text-xs text-muted-foreground hover:bg-muted border-t border-border"
          >
            Close
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(false)}
            placeholder={placeholder || defaultPlaceholder}
            disabled={isLoading}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg',
              'bg-input border border-border text-sm',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'disabled:opacity-50'
            )}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className={cn(
              'p-2 rounded-lg',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press @ to attach rooms{mode === 'regroup' ? ' or groups' : ''} for context
        </p>
      </form>
    </div>
  );
}

export type { AttachedItem };
