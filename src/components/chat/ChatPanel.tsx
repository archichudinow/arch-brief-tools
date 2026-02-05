import { useRef, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useChatStore, useUIStore, useProjectStore } from '@/stores';
import { 
  sendChatMessage, 
  buildChatRequest, 
  addIdsToProposals, 
  enhancePrompt, 
  tryDeterministicOperation,
  generateFormulaProgram,
  formulaResponseToProposals,
  resolveClarification,
  expandArea,
  type EnhancedPrompt,
  type ClarificationOption,
} from '@/services';
import { MessageBubble } from './MessageBubble';
import { BriefInput } from './BriefInput';
import { ExpandDepthSelector, type ExploreDepth } from './ExpandDepthSelector';
import { ClarificationCard } from './ClarificationCard';
import type { ScaleClarificationOption, Proposal } from '@/types';
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
  
  // Formula-based workflow state
  const [expandDepth, setExpandDepth] = useState<ExploreDepth>(1);
  const [clarificationPending, setClarificationPending] = useState<{
    originalInput: string;
    message: string;
    options: ScaleClarificationOption[];
  } | null>(null);
  
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
    setInputValue('');
    
    // Get selected items
    const selectedNodes = selectedNodeIds.map((id) => nodes[id]).filter(Boolean);
    const selectedGroups = selectedGroupIds.map((id) => groups[id]).filter(Boolean);
    
    // Add user message
    addUserMessage(content, selectedNodeIds, selectedGroupIds);
    setLoading(true);
    
    try {
      // FIRST: Try deterministic operation (for scale/adjust - faster, exact math)
      const deterministicResult = tryDeterministicOperation(
        content,
        selectedNodes,
        selectedGroups,
        nodes
      );
      
      if (deterministicResult.handled && deterministicResult.response) {
        console.log('Handled deterministically:', deterministicResult.intent?.type);
        
        const proposals = deterministicResult.response.proposals
          ? addIdsToProposals(deterministicResult.response.proposals)
          : undefined;
        
        addAIMessage(deterministicResult.response.message, proposals);
        setLoading(false);
        return;
      }
      
      // EXPAND/UNFOLD: When user wants to break down selected areas
      const isExpandRequest = content.toLowerCase().match(
        /\b(expand|unfold|break\s*down|detail|sub-?divide|elaborate)\b/i
      );
      
      if (chatMode === 'agent' && isExpandRequest && selectedNodes.length > 0) {
        console.log('Using formula-based expand for selected areas');
        
        // Expand each selected node
        const allProposals: Proposal[] = [];
        let responseMessage = '';
        
        for (const node of selectedNodes) {
          const expandResponse = await expandArea(node, expandDepth, content);
          
          if (expandResponse.warnings?.includes('area_too_small')) {
            responseMessage += expandResponse.message + '\n';
            continue;
          }
          
          const proposals = formulaResponseToProposals(expandResponse, node);
          allProposals.push(...proposals);
          responseMessage += expandResponse.message + '\n';
        }
        
        addAIMessage(
          responseMessage.trim() || `Expanded ${selectedNodes.length} area(s)`,
          allProposals.length > 0 ? allProposals : undefined
        );
        setLoading(false);
        return;
      }
      
      // FORMULA-BASED APPROACH: Use for program generation
      // Check if this looks like a brief/program request
      const isProgramRequest = content.toLowerCase().match(
        /\b(create|generate|make|design|plan|breakdown|program|layout|split|hotel|office|apartment|building|residential|commercial)\b/i
      );
      
      if (chatMode === 'agent' && isProgramRequest) {
        // Extract total area from brief text (e.g., "8000 sqm", "10,000 m²", "5000m2")
        const areaMatch = content.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sqm|m²|m2|square\s*met(?:er|re)s?)\b/i);
        const extractedArea = areaMatch ? parseFloat(areaMatch[1].replace(/,/g, '')) : undefined;
        
        console.log(`Using formula-based generation with depth ${expandDepth}, extracted area: ${extractedArea}`);
        
        const formulaResponse = await generateFormulaProgram(content, extractedArea, expandDepth);
        
        // Handle clarification needed
        if (formulaResponse.clarification_needed && formulaResponse.options) {
          setClarificationPending({
            originalInput: content,
            message: formulaResponse.message,
            options: formulaResponse.options as ScaleClarificationOption[],
          });
          addAIMessage(formulaResponse.message);
          setLoading(false);
          return;
        }
        
        // Convert to proposals
        const proposals = formulaResponseToProposals(formulaResponse);
        addAIMessage(formulaResponse.message, proposals.length > 0 ? proposals : undefined);
        setLoading(false);
        return;
      }
      
      // FALLBACK: Use standard LLM for other operations
      console.log('Using standard LLM');
      
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
      
      // Send to AI with mode and context for intent processing
      const allNodes = Object.values(nodes);
      const allGroups = Object.values(groups);
      const response = await sendChatMessage(
        request, 
        chatMode,
        chatMode === 'agent' ? { nodes: allNodes, groups: allGroups } : undefined
      );
      
      console.log('Chat response:', response);
      
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
      
      // Pass context for intent processing in agent mode
      const allNodes = Object.values(nodes);
      const allGroups = Object.values(groups);
      const response = await sendChatMessage(
        request, 
        chatMode,
        chatMode === 'agent' ? { nodes: allNodes, groups: allGroups } : undefined
      );
      
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
        <div className="px-3 py-2 bg-muted/30 text-xs border-b border-border space-y-1.5">
          {/* Row 1: Mode and Context */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Mode:</span>
              <Badge variant={chatMode === 'agent' ? 'default' : 'secondary'} className="text-[10px] h-5">
                {chatMode === 'agent' ? 'Agent' : 'Q&A'}
              </Badge>
            </div>
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
          {/* Row 2: Expand Depth (for tree exploration) */}
          <ExpandDepthSelector depth={expandDepth} onDepthChange={setExpandDepth} />
        </div>
      )}
      
      {briefMode ? (
        <BriefInput />
      ) : (
        <>
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
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">AI Assistant</p>
                  <p className="text-xs mt-1">
                    Describe your project and total area.<br />
                    AI will generate a formula-based breakdown.
                  </p>
                  <div className="my-4 w-32 h-px bg-border" />
                  <p className="text-xs">
                    Click any area to <strong>expand</strong> it further,<br />
                    or switch to <strong>Brief Mode</strong>
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
