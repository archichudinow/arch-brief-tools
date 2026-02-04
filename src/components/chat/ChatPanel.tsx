import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useChatStore, useUIStore, useProjectStore } from '@/stores';
import { sendChatMessage, buildChatRequest, addIdsToProposals, enhancePrompt, type EnhancedPrompt } from '@/services';
import { MessageBubble } from './MessageBubble';
import { BriefInput } from './BriefInput';
import { 
  Send, 
  Loader2, 
  Trash2, 
  FileText, 
  MessageSquare,
  Sparkles,
  Bot,
  HelpCircle,
  Wand2,
  X,
  Play
} from 'lucide-react';

export function ChatPanel() {
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
  const chatMode = useChatStore((s) => s.chatMode);
  const setChatMode = useChatStore((s) => s.setChatMode);
  const aiRole = useChatStore((s) => s.aiRole);
  
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Enhanced prompts state
  const [enhancedPrompts, setEnhancedPrompts] = useState<EnhancedPrompt[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Focus input when not in brief mode
  useEffect(() => {
    if (inputRef.current && !briefMode) {
      inputRef.current.focus();
    }
  }, [briefMode]);
  
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
      // Build request with chat mode configuration
      const request = buildChatRequest(
        content,
        projectContext,
        selectedNodes,
        selectedGroups,
        nodes,
        groups,
        { mode: chatMode, role: aiRole ?? undefined }
      );
      
      // Send to AI with mode
      const response = await sendChatMessage(request, chatMode);
      
      console.log('Chat response:', response);
      console.log('Proposals from response:', response.proposals);
      
      // Add proposals with IDs (only in agent mode)
      const proposals = response.proposals
        ? addIdsToProposals(response.proposals)
        : undefined;
      
      console.log('Proposals with IDs:', JSON.stringify(proposals, null, 2));
      
      addAIMessage(response.message, proposals);
      console.log('AI message added with proposals');
      
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
  
  const handleEnhance = async () => {
    if (!inputValue.trim() || isEnhancing || isLoading) return;
    
    setIsEnhancing(true);
    
    try {
      const selectedNodes = selectedNodeIds.map((id) => nodes[id]).filter(Boolean);
      const selectedGroups = selectedGroupIds.map((id) => groups[id]).filter(Boolean);
      
      const options = await enhancePrompt(
        inputValue,
        selectedNodes,
        selectedGroups,
        nodes,
        groups
      );
      
      setEnhancedPrompts(options);
    } catch (error) {
      console.error('Enhance error:', error);
      addSystemMessage('Failed to enhance prompt. Try sending directly.', 'warning');
    } finally {
      setIsEnhancing(false);
    }
  };
  
  const handleSelectEnhanced = async (option: EnhancedPrompt) => {
    // Clear enhanced options
    setEnhancedPrompts([]);
    
    // Update input with selected prompt and send
    setInputValue(option.prompt);
    
    // Get selected items
    const selectedNodes = selectedNodeIds.map((id) => nodes[id]).filter(Boolean);
    const selectedGroups = selectedGroupIds.map((id) => groups[id]).filter(Boolean);
    
    // Add user message
    addUserMessage(option.prompt, selectedNodeIds, selectedGroupIds);
    setLoading(true);
    
    try {
      const request = buildChatRequest(
        option.prompt,
        projectContext,
        selectedNodes,
        selectedGroups,
        nodes,
        groups,
        { mode: chatMode, role: aiRole ?? undefined }
      );
      
      const response = await sendChatMessage(request, chatMode);
      
      const proposals = response.proposals
        ? addIdsToProposals(response.proposals)
        : undefined;
      
      addAIMessage(response.message, proposals);
    } catch (error) {
      console.error('Chat error:', error);
      addSystemMessage('Failed to get response. Please try again.', 'error');
    } finally {
      setLoading(false);
      setInputValue('');
    }
  };
  
  const handleCancelEnhance = () => {
    setEnhancedPrompts([]);
  };
  
  return (
    <aside className="w-96 border-l border-border bg-card flex flex-col h-full">
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
          {/* Chat Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatMode(chatMode === 'agent' ? 'consultation' : 'agent')}
            className={chatMode === 'consultation' ? 'bg-muted' : ''}
            title={chatMode === 'agent' ? 'Agent Mode (actions)' : 'Consultation Mode (Q&A)'}
          >
            {chatMode === 'agent' ? <Bot className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
          </Button>
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
        </div>
      </div>
      
      {/* Mode indicator */}
      {!briefMode && (
        <div className="px-4 py-1 bg-muted/30 text-xs border-b border-border flex items-center gap-2">
          <span className="text-muted-foreground">Mode:</span>
          <Badge variant={chatMode === 'agent' ? 'default' : 'secondary'} className="text-xs">
            {chatMode === 'agent' ? 'Agent' : 'Consultation'}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {chatMode === 'agent' ? '(proposes actions)' : '(answers questions)'}
          </span>
        </div>
      )}
      
      {briefMode ? (
        <BriefInput />
      ) : (
        <>
          {/* Context bar */}
          <div className="px-4 py-2 bg-muted/50 text-xs border-b border-border">
            {(selectedNodeIds.length > 0 || selectedGroupIds.length > 0) ? (
              <>
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
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Context:</span>
                <Badge variant="secondary" className="text-xs">
                  All {Object.keys(nodes).length} areas
                </Badge>
                <span className="text-xs italic">(select specific areas to narrow context)</span>
              </div>
            )}
          </div>
          
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
                  <div className="my-4 w-32 h-px bg-border" />
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
            {/* Enhanced Prompts Options */}
            {enhancedPrompts.length > 0 && (
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Wand2 className="w-3 h-3" />
                    Choose an option:
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEnhance}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                {enhancedPrompts.map((option, i) => (
                  <Card 
                    key={i} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectEnhanced(option)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Play className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{option.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{option.prompt}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {option.operations.slice(0, 3).map((op, j) => (
                              <Badge key={j} variant="secondary" className="text-xs">
                                {op}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about areas, request changes..."
                className="min-h-[80px] max-h-[120px] resize-none"
                disabled={isLoading || isEnhancing}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-muted-foreground">
                Shift+Enter for new line
              </p>
              <div className="flex gap-2">
                {/* Enhance Button */}
                <Button 
                  onClick={handleEnhance} 
                  disabled={!inputValue.trim() || isLoading || isEnhancing}
                  size="sm"
                  variant="outline"
                  title="Suggest refined prompts"
                >
                  {isEnhancing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-1" />
                      Enhance
                    </>
                  )}
                </Button>
                {/* Send Button */}
                <Button 
                  onClick={handleSend} 
                  disabled={!inputValue.trim() || isLoading || isEnhancing}
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
          </div>
        </>
      )}
    </aside>
  );
}
