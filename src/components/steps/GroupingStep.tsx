import { useState, useCallback, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/utils';
import { proposeGrouping, regroupPrograms, isOpenAIConfigured } from '@/lib/openai';
import { 
  Sparkles, Loader2, AlertCircle, ArrowRight, ArrowLeft,
  ChevronDown, ChevronUp, Users, Building, Layers, Check, MessageSquare
} from 'lucide-react';
import { ChatPanel, type AttachedItem } from '@/components/chat/ChatPanel';
import type { FunctionalGroup, Classification, ChatMessage } from '@/types';

const CLASSIFICATION_COLORS: Record<Classification, string> = {
  'public': 'bg-green-500/20 text-green-400 border-green-500/30',
  'semi-public': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'private': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  'public': 'Public',
  'semi-public': 'Semi-Public',
  'private': 'Private',
};

export function GroupingStep() {
  const { state, dispatch } = useApp();
  const { normalized, groups } = state;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<AttachedItem[]>([]);
  
  // AbortController ref for canceling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get program items for display
  const programItems = normalized?.items ?? [];

  if (!normalized || programItems.length === 0) {
    return (
      <div className="max-w-4xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <h1 className="text-2xl font-semibold">No Program Data</h1>
          <p className="text-muted-foreground mt-2 max-w-md">
            Complete the normalization step first to define program items.
          </p>
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 'normalize' })}
            className={cn(
              'mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg',
              'bg-primary text-primary-foreground font-medium',
              'hover:bg-primary/90 transition-colors'
            )}
          >
            Go to Normalize
          </button>
        </div>
      </div>
    );
  }

  const handleProposeGrouping = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await proposeGrouping(programItems);
      dispatch({ type: 'SET_GROUPS', payload: result.groups });
      
      // Show chat for refinement
      setShowChat(true);
      setChatMessages([{
        id: 'initial',
        role: 'assistant',
        content: `I've organized ${programItems.length} programs into ${result.groups.length} groups. You can ask me to merge groups, split them, or move programs between groups.`,
        timestamp: new Date(),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to propose grouping');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSend = useCallback(async (message: string, attachedItems: AttachedItem[]) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      attachedItems: attachedItems.map(i => i.label),
    };
    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);
    setSelectedItems([]);
    
    // Create AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      const attachedProgramIds = attachedItems
        .filter(i => i.type === 'program')
        .map(i => i.id);
      const attachedGroupIds = attachedItems
        .filter(i => i.type === 'group')
        .map(i => i.id);
      
      const result = await regroupPrograms(
        groups,
        programItems,
        message,
        attachedProgramIds,
        attachedGroupIds,
        abortController.signal
      );
      
      // Handle new programs if AI created any (for "per group" items when splitting)
      if (result.newPrograms && result.newPrograms.length > 0) {
        result.newPrograms.forEach(program => {
          dispatch({ type: 'ADD_PROGRAM_ITEM', payload: program });
        });
      }
      
      dispatch({ type: 'SET_GROUPS', payload: result.groups });
      
      // Build response message
      let responseContent = result.response || `Done! Updated the grouping. Now showing ${result.groups.length} groups.`;
      if (result.newPrograms && result.newPrograms.length > 0) {
        responseContent += `\n\nNote: Added ${result.newPrograms.length} new program(s) to support the split.`;
      }
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      // Don't show error for aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        const cancelMessage: ChatMessage = {
          id: `cancelled-${Date.now()}`,
          role: 'assistant',
          content: 'Request cancelled.',
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, cancelMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I couldn't process that: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsChatLoading(false);
      abortControllerRef.current = null;
    }
  }, [groups, programItems, dispatch]);

  const handleChatStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleSelectItem = useCallback((item: AttachedItem) => {
    setSelectedItems(prev => {
      if (prev.find(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const handleProceed = () => {
    dispatch({ type: 'COMPLETE_STEP', payload: 'grouping' });
    dispatch({ type: 'SET_STEP', payload: 'rules' });
  };

  const getGroupArea = (group: FunctionalGroup) => {
    return programItems
      .filter(item => group.programIds.includes(item.id))
      .reduce((sum, item) => sum + item.area, 0);
  };

  const getUnassignedPrograms = () => {
    const assignedIds = new Set(groups.flatMap(g => g.programIds));
    return programItems.filter(item => !assignedIds.has(item.id));
  };

  const unassigned = getUnassignedPrograms();
  const apiConfigured = isOpenAIConfigured();

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Functional Grouping</h1>
        <p className="text-muted-foreground mt-1">
          Organize program items into functional groups for building design.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* AI Proposal Button */}
      {groups.length === 0 && (
        <section className="p-6 rounded-lg border-2 border-dashed border-border text-center">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h3 className="text-lg font-medium">AI Grouping Proposal</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Let AI analyze your program and suggest functional groupings
          </p>
          
          {!apiConfigured && (
            <p className="text-xs text-yellow-500 mb-4">
              OpenAI API key required. Add VITE_OPENAI_API_KEY to .env.local
            </p>
          )}
          
          <button
            onClick={handleProposeGrouping}
            disabled={isLoading || !apiConfigured}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg mx-auto',
              'bg-primary text-primary-foreground font-medium',
              'hover:bg-primary/90 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isLoading ? 'Analyzing...' : 'Propose Grouping with AI'}
          </button>
        </section>
      )}

      {/* Groups List */}
      {groups.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Functional Groups ({groups.length})
            </h3>
            <button
              onClick={handleProposeGrouping}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
                'bg-muted text-muted-foreground hover:bg-muted/80 transition-colors',
                'disabled:opacity-50'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Re-generate
            </button>
          </div>

          <div className="space-y-3">
            {groups.map(group => {
              const isExpanded = expandedGroup === group.id;
              const groupArea = getGroupArea(group);
              const groupPrograms = programItems.filter(
                item => group.programIds.includes(item.id)
              );

              return (
                <div
                  key={group.id}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  {/* Group Header */}
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div
                      className="w-4 h-4 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{group.name}</span>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs border',
                          CLASSIFICATION_COLORS[group.classification]
                        )}>
                          {CLASSIFICATION_LABELS[group.classification]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {group.programIds.length} programs · {groupArea.toLocaleString()} sqm
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {group.preferredPlacement.ground && (
                        <span title="Ground floor"><Building className="w-4 h-4" /></span>
                      )}
                      {group.preferredPlacement.tower && (
                        <span title="Tower"><Layers className="w-4 h-4" /></span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-muted/20">
                      {/* AI Notes */}
                      {group.aiNotes && (
                        <div className="mb-4 p-3 rounded-lg bg-primary/10 text-sm">
                          <p className="text-xs text-primary font-medium mb-1">AI Notes</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{group.aiNotes}</p>
                        </div>
                      )}

                      {/* User Comment */}
                      {group.userComment && (
                        <div className="mb-4 p-3 rounded-lg bg-secondary text-sm">
                          <p className="text-xs text-muted-foreground font-medium mb-1">Your Notes</p>
                          <p>{group.userComment}</p>
                        </div>
                      )}

                      {/* Placement Preferences */}
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2">Placement Preferences</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(group.preferredPlacement).map(([key, value]) => (
                            <span
                              key={key}
                              className={cn(
                                'px-2 py-1 rounded text-xs',
                                value
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {value && <Check className="w-3 h-3 inline mr-1" />}
                              {key}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Program List */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">Programs in this group</p>
                          {showChat && (
                            <button
                              onClick={() => handleSelectItem({ type: 'group', id: group.id, label: group.name })}
                              className="text-xs text-primary hover:underline"
                            >
                              Attach to chat
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {groupPrograms.map(program => (
                            <div
                              key={program.id}
                              className="flex items-center justify-between text-sm py-1 group/item"
                            >
                              <span className="flex items-center gap-2">
                                {program.name}
                                {program.aiNotes && (
                                  <span className="text-xs text-muted-foreground" title={program.aiNotes}>
                                    💡
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">
                                  {program.quantity > 1 ? `${program.quantity}× ` : ''}
                                  {program.totalArea.toLocaleString()} sqm
                                </span>
                                {showChat && (
                                  <button
                                    onClick={() => handleSelectItem({ type: 'program', id: program.id, label: program.name })}
                                    className="text-xs text-primary opacity-0 group-hover/item:opacity-100 transition-opacity"
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Unassigned Programs */}
      {unassigned.length > 0 && groups.length > 0 && (
        <section className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <h3 className="text-sm font-medium text-yellow-400 mb-2">
            Unassigned Programs ({unassigned.length})
          </h3>
          <div className="space-y-1">
            {unassigned.map(program => (
              <div
                key={program.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{program.name}</span>
                <span className="text-muted-foreground">
                  {program.area.toLocaleString()} sqm
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Chat Panel for Regrouping */}
      {showChat && groups.length > 0 && (
        <section>
          <ChatPanel
            mode="regroup"
            messages={chatMessages}
            onSend={handleChatSend}
            onStop={handleChatStop}
            isLoading={isChatLoading}
            programs={programItems}
            groups={groups}
            selectedItems={selectedItems}
            onSelectItem={handleSelectItem}
            onRemoveItem={handleRemoveItem}
            placeholder="Merge groups, split clusters, or move programs..."
          />
        </section>
      )}

      {/* Actions */}
      <section className="flex items-center justify-between pt-4 border-t border-border">
        <button
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'normalize' })}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg',
            'bg-secondary text-secondary-foreground font-medium',
            'hover:bg-secondary/80 transition-colors'
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Normalize
        </button>
        
        <div className="flex items-center gap-3">
          {groups.length > 0 && (
            <button
              onClick={() => setShowChat(!showChat)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg',
                'bg-secondary text-secondary-foreground font-medium',
                'hover:bg-secondary/80 transition-colors',
                showChat && 'bg-primary/20'
              )}
            >
              <MessageSquare className="w-4 h-4" />
              {showChat ? 'Hide Chat' : 'Adjust with Chat'}
            </button>
          )}
          
          <button
            onClick={handleProceed}
            disabled={groups.length === 0}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg',
              'bg-primary text-primary-foreground font-medium',
              'hover:bg-primary/90 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Proceed to Rules
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
