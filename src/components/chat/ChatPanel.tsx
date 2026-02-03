import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useChatStore, useUIStore, useProjectStore } from '@/stores';
import { sendChatMessage, buildChatRequest, addIdsToProposals } from '@/services';
import { MessageBubble } from './MessageBubble';
import { BriefInput } from './BriefInput';
import { 
  X, 
  Send, 
  Loader2, 
  Trash2, 
  FileText, 
  MessageSquare,
  Sparkles 
} from 'lucide-react';

export function ChatPanel() {
  const isOpen = useChatStore((s) => s.isOpen);
  const closeChat = useChatStore((s) => s.closeChat);
  const messages = useChatStore((s) => s.messages);
  const inputValue = useChatStore((s) => s.inputValue);
  const setInputValue = useChatStore((s) => s.setInputValue);
  const isLoading = useChatStore((s) => s.isLoading);
  const setLoading = useChatStore((s) => s.setLoading);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const addAIMessage = useChatStore((s) => s.addAIMessage);
  const addSystemMessage = useChatStore((s) => s.addSystemMessage);
  const clearChat = useChatStore((s) => s.clearChat);
  const projectContext = useChatStore((s) => s.projectContext);
  const briefMode = useChatStore((s) => s.briefMode);
  const setBriefMode = useChatStore((s) => s.setBriefMode);
  const pendingProposals = useChatStore((s) => s.pendingProposals);
  
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current && !briefMode) {
      inputRef.current.focus();
    }
  }, [isOpen, briefMode]);
  
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const content = inputValue.trim();
    
    // Get selected items
    const selectedNodes = selectedNodeIds.map((id) => nodes[id]).filter(Boolean);
    const selectedGroups = selectedGroupIds.map((id) => groups[id]).filter(Boolean);
    
    // Add user message
    addUserMessage(content, selectedNodeIds, selectedGroupIds);
    setLoading(true);
    
    try {
      // Build request
      const request = buildChatRequest(
        content,
        projectContext,
        selectedNodes,
        selectedGroups,
        nodes
      );
      
      // Send to AI - returns already-parsed AIResponse
      const response = await sendChatMessage(request);
      
      console.log('Chat response:', response);
      console.log('Proposals from response:', response.proposals);
      
      // Add proposals with IDs
      const proposals = response.proposals
        ? addIdsToProposals(response.proposals)
        : undefined;
      
      console.log('Proposals with IDs:', JSON.stringify(proposals, null, 2));
      
      addAIMessage(response.message, proposals);
      console.log('AI message added with proposals');
      
      if (response.assumptions && response.assumptions.length > 0) {
        addSystemMessage(
          `Assumptions: ${response.assumptions.join(', ')}`,
          'info'
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      addSystemMessage('Failed to get response. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="w-96 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">AI Assistant</h2>
          {pendingProposals.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendingProposals.length} pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setBriefMode(!briefMode)}
            className={briefMode ? 'bg-muted' : ''}
            title={briefMode ? 'Switch to Chat' : 'Parse Brief'}
          >
            {briefMode ? <MessageSquare className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={clearChat} title="Clear chat">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={closeChat}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {briefMode ? (
        <BriefInput />
      ) : (
        <>
          {/* Context bar */}
          {(selectedNodeIds.length > 0 || selectedGroupIds.length > 0) && (
            <div className="px-4 py-2 bg-muted/50 text-xs border-b border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Context:</span>
                {selectedNodeIds.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {selectedNodeIds.length} area{selectedNodeIds.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {selectedGroupIds.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {selectedGroupIds.length} group{selectedGroupIds.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {selectedNodeIds.length > 0 && selectedNodeIds.length <= 5 && (
                <div className="mt-1 text-muted-foreground truncate">
                  {selectedNodeIds.map((id) => nodes[id]?.name).filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          )}
          
          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="px-4 py-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">AI Assistant</p>
                  <p className="text-xs mt-1">
                    Ask questions about your areas,<br />
                    request splits, merges, or analysis
                  </p>
                  <Separator className="my-4 w-32" />
                  <p className="text-xs">
                    Or switch to <strong>Brief Mode</strong><br />
                    to parse a project brief
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input */}
          <div className="p-4 border-t border-border flex-shrink-0">
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about areas, request changes..."
                className="min-h-[80px] max-h-[120px] resize-none"
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-muted-foreground">
                Shift+Enter for new line
              </p>
              <Button 
                onClick={handleSend} 
                disabled={!inputValue.trim() || isLoading}
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
