import { useRef, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useChatStore, useUIStore, useProjectStore } from '@/stores';
import { 
  addIdsToProposals, 
  enhancePrompt, 
  formulaResponseToProposals,
  resolveClarification,
  actionRegistry,
  runAgent,
  analyzeInput,
  type EnhancedPrompt,
  type ClarificationOption,
  type ExpandDetailLevel,
  type ActionContext,
  type AgentContext,
} from '@/services';
import { MessageBubble } from './MessageBubble';
import { DetailLevelSelector } from './ExpandDepthSelector';
import { ClarificationCard } from './ClarificationCard';
import type { ScaleClarificationOption } from '@/types';
import { 
  Send, 
  Loader2, 
  Trash2, 
  Sparkles,
  Wand2,
  X,
  Play
} from 'lucide-react';

// Helper to render action summary with highlighted verbs
function renderActionSummary(text: string): ReactNode {
  // Split by **word** patterns and render highlighted parts
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const word = part.slice(2, -2);
      return (
        <span key={i} className="font-semibold text-primary">
          {word}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

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
  const pendingProposals = useChatStore((s) => s.pendingProposals);
  
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCountRef = useRef(0);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Enhanced prompts state
  const [enhancedPrompts, setEnhancedPrompts] = useState<EnhancedPrompt[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Formula-based workflow state
  const [detailLevel, setDetailLevel] = useState<ExpandDetailLevel>('typical');
  const [clarificationPending, setClarificationPending] = useState<{
    originalInput: string;
    message: string;
    options: ScaleClarificationOption[];
  } | null>(null);

  // Scroll to first new message when AI/system messages appear
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;
    
    if (currentCount > prevCount && prevCount > 0) {
      // New messages appeared - check if it's not just a user message
      const firstNewMessage = messages[prevCount];
      if (firstNewMessage && firstNewMessage.role !== 'user') {
        const element = messageRefs.current.get(firstNewMessage.id);
        if (element) {
          // Scroll the element into view at the top with some padding
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } else if (currentCount > 0 && prevCount === 0) {
      // First message(s) appeared - scroll to top
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
    
    prevMessageCountRef.current = currentCount;
  }, [messages]);
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const content = inputValue.trim();
    setInputValue('');
    
    // Add user message
    addUserMessage(content, selectedNodeIds, selectedGroupIds);
    setLoading(true);
    
    try {
      // Build action context
      const actionContext: ActionContext = {
        nodes,
        groups,
        detailLevel,
        prompt: content,
        projectContext: projectContext || undefined,
      };
      
      // AGENT MODE: Always use full agent
      {
        // Check if content looks like a brief (tabular data with areas)
        // Briefs use action registry for better parsing
        const inputAnalysis = analyzeInput(content);
        const looksLikeBrief = inputAnalysis.type === 'structured' || 
          inputAnalysis.type === 'dirty' ||
          (content.length > 500 && /\d+\s*[×x]\s*\d+|\d+\s*(?:sqm|m²|m2)/i.test(content));
        
        if (looksLikeBrief) {
          // Use action registry for briefs
          console.log('[Agent] Detected brief-like content, using action registry for parsing');
          
          const selectedNodes = selectedNodeIds.map((id) => nodes[id]).filter(Boolean);
          const match = actionRegistry.classify(content, selectedNodes, actionContext);
          
          if (match) {
            const { action } = match;
            const validation = action.validate(content, selectedNodes, actionContext);
            if (!validation.valid) {
              addAIMessage(validation.error || 'Cannot perform this action.');
              setLoading(false);
              return;
            }
            
            const result = await action.execute(content, selectedNodes, actionContext);
            const proposals = action.toProposals(result, selectedNodes, actionContext);
            const proposalsWithIds = proposals.length > 0 
              ? addIdsToProposals(proposals) 
              : undefined;
            
            addAIMessage(result.message, proposalsWithIds);
            setLoading(false);
            return;
          }
        }
        
        // FULL AGENT MODE: OpenAI tool-calling
        console.log('[FullAgent] Using OpenAI tool-calling agent');
          
          const agentContext: AgentContext = {
            nodes,
            groups,
            selectedNodeIds,
            selectedGroupIds,
            detailLevel,
            projectContext: projectContext || undefined,
          };
          
          try {
            const agentResult = await runAgent(content, agentContext);
            
            console.log(`[FullAgent] Completed in ${agentResult.iterations} iterations`);
            console.log(`[FullAgent] Tool calls:`, agentResult.toolCalls);
            
            // Build message with tool call summary
            let message = agentResult.message;
            if (agentResult.toolCalls.length > 0) {
              const toolSummary = agentResult.toolCalls
                .map(tc => `• ${tc.tool}: ${tc.result}`)
                .join('\n');
              message = `${agentResult.message}\n\n**Actions taken:**\n${toolSummary}`;
            }
            
            // Add proposals if any
            const proposalsWithIds = agentResult.proposals.length > 0 
              ? addIdsToProposals(agentResult.proposals) 
              : undefined;
            
            addAIMessage(message, proposalsWithIds);
            setLoading(false);
            return;
          } catch (error) {
            console.error('[FullAgent] Error:', error);
            addSystemMessage(
              `Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              'error'
            );
            setLoading(false);
            return;
          }
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
  
  // Handle clarification selection
  const handleClarificationSelect = async (option: ScaleClarificationOption) => {
    if (!clarificationPending) return;
    
    setClarificationPending(null);
    setLoading(true);
    
    try {
      const clarificationOption: ClarificationOption = {
        label: option.label,
        area: option.area,
        scale: option.scale,
        interpretation: option.interpretation,
      };
      
      const formulaResponse = await resolveClarification(
        clarificationPending.originalInput,
        clarificationOption
      );
      
      const proposals = formulaResponseToProposals(formulaResponse);
      addAIMessage(formulaResponse.message, proposals.length > 0 ? proposals : undefined);
    } catch (error) {
      console.error('Clarification error:', error);
      addSystemMessage('Failed to process clarification. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClarificationDismiss = () => {
    setClarificationPending(null);
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
    // Clear enhanced options and set the selected prompt
    setEnhancedPrompts([]);
    setInputValue(option.prompt);
    
    // Trigger send with the enhanced prompt
    // Note: We need to use the prompt directly since setInputValue is async
    const content = option.prompt;
    
    // Add user message
    addUserMessage(content, selectedNodeIds, selectedGroupIds);
    setLoading(true);
    
    try {
      // Always use the full agent
      console.log('[FullAgent] Using OpenAI tool-calling agent for enhanced prompt');
      
      const agentContext: AgentContext = {
        nodes,
        groups,
        selectedNodeIds,
        selectedGroupIds,
        detailLevel,
        projectContext: projectContext || undefined,
      };
      
      const agentResult = await runAgent(content, agentContext);
      
      // Build message with tool call summary
      let message = agentResult.message;
      if (agentResult.toolCalls.length > 0) {
        const toolSummary = agentResult.toolCalls
          .map(tc => `• ${tc.tool}: ${tc.result}`)
          .join('\n');
        message = `${agentResult.message}\n\n**Actions taken:**\n${toolSummary}`;
      }
      
      // Add proposals if any
      const proposalsWithIds = agentResult.proposals.length > 0 
        ? addIdsToProposals(agentResult.proposals) 
        : undefined;
      
      addAIMessage(message, proposalsWithIds);
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
          <Button variant="ghost" size="icon" onClick={clearChat} title="Clear chat">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Context indicator */}
      <div className="px-3 py-2 bg-muted/30 text-xs border-b border-border space-y-1.5">
        {/* Row 1: Context */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Context:</span>
            {(selectedNodeIds.length > 0 || selectedGroupIds.length > 0) ? (
              <div className="flex items-center gap-1">
                {selectedNodeIds.length > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {selectedNodeIds.length} area{selectedNodeIds.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {selectedGroupIds.length > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {selectedGroupIds.length} group{selectedGroupIds.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            ) : (
              <Badge variant="secondary" className="text-[10px] h-5">
                All {Object.keys(nodes).length}
              </Badge>
            )}
          </div>
        </div>
        {/* Row 2: Level of Detail (for Create and Unfold operations) */}
        <DetailLevelSelector level={detailLevel} onLevelChange={setDetailLevel} />
      </div>
      
      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="px-4 py-4">
          {/* Show clarification card if pending */}
          {clarificationPending && (
            <div className="mb-4">
              <ClarificationCard
                message={clarificationPending.message}
                options={clarificationPending.options}
                onSelect={handleClarificationSelect}
                onDismiss={handleClarificationDismiss}
              />
            </div>
          )}
          
          {messages.length === 0 && !clarificationPending ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
              <Sparkles className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium mb-2">AI Assistant</p>
              <p className="text-xs leading-relaxed max-w-[240px]">
                <strong>Create</strong> a program, <strong>parse</strong> a brief,<br />
                <strong>unfold</strong> areas, or <strong>scale</strong> values.
              </p>
              <div className="my-4 w-32 h-px bg-border" />
              <p className="text-[11px] text-muted-foreground/70">
                Examples:<br />
                "Create hotel 5000 sqm"<br />
                "Parse: Guest rooms 200x35m²..."<br />
                Select area → "unfold"
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  ref={(el) => {
                    if (el) {
                      messageRefs.current.set(msg.id, el);
                    } else {
                      messageRefs.current.delete(msg.id);
                    }
                  }}
                >
                  <MessageBubble message={msg} />
                </div>
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
                      {/* Action summary with highlighted verbs */}
                      <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">
                        {option.actionSummary ? renderActionSummary(option.actionSummary) : option.prompt}
                      </p>
                      {/* Operations as small badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {option.operations.slice(0, 4).map((op, j) => (
                          <Badge key={j} variant="outline" className="text-[10px] font-normal py-0">
                            {op}
                          </Badge>
                        ))}
                        {option.operations.length > 4 && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0 text-muted-foreground">
                            +{option.operations.length - 4} more
                          </Badge>
                        )}
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
            placeholder="Create hotel 5000m², parse brief, unfold area, +10%..."
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
    </aside>
  );
}
