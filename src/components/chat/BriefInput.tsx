import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useChatStore, useProjectStore, useHistoryStore } from '@/stores';
import { 
  parseBrief, 
  sendChatMessage, 
  buildChatRequest, 
  addIdsToProposals,
  analyzeInput,
  getInputTypeDescription,
  getStrategyDescription,
  type InputClassification,
} from '@/services';
import type { ParsedBrief, ParsedBriefArea } from '@/types';
import { 
  FileText, 
  Loader2, 
  Check, 
  X, 
  AlertTriangle,
  Plus,
  Sparkles,
  FolderTree,
  Layers,
  Calculator,
  CheckCircle2,
  XCircle,
  Wand2,
  FileQuestion,
  Table,
  Ban,
  Info
} from 'lucide-react';

type ParseState = 'input' | 'parsing' | 'preview' | 'error' | 'organizing' | 'redirect';

// Helper to get icon for input type
function getInputTypeIcon(type: InputClassification['type']) {
  switch (type) {
    case 'prompt': return Wand2;
    case 'dirty': return FileQuestion;
    case 'structured': return Table;
    case 'garbage': return Ban;
  }
}

// Helper to get color for quality level
function getQualityColor(quality: InputClassification['quality']) {
  switch (quality) {
    case 'high': return 'text-green-600 bg-green-50';
    case 'medium': return 'text-yellow-600 bg-yellow-50';
    case 'low': return 'text-red-600 bg-red-50';
  }
}

export function BriefInput() {
  const briefText = useChatStore((s) => s.briefText);
  const setBriefText = useChatStore((s) => s.setBriefText);
  const setProjectContext = useChatStore((s) => s.setProjectContext);
  const addSystemMessage = useChatStore((s) => s.addSystemMessage);
  const setBriefMode = useChatStore((s) => s.setBriefMode);
  
  const createNode = useProjectStore((s) => s.createNode);
  const createGroup = useProjectStore((s) => s.createGroup);
  const assignToGroup = useProjectStore((s) => s.assignToGroup);
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const snapshot = useHistoryStore((s) => s.snapshot);
  
  const [parseState, setParseState] = useState<ParseState>('input');
  const [parsedBrief, setParsedBrief] = useState<ParsedBrief | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<Set<number>>(new Set());
  const [selectedSuggested, setSelectedSuggested] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [autoOrganize, setAutoOrganize] = useState(false);
  
  const addAIMessage = useChatStore((s) => s.addAIMessage);
  
  // Analyze input in real-time for preview
  const inputClassification = useMemo(() => {
    if (!briefText.trim()) return null;
    return analyzeInput(briefText);
  }, [briefText]);
  
  const handleParse = async () => {
    if (!briefText.trim()) return;
    
    setParseState('parsing');
    setError(null);
    
    try {
      // Parse the brief (no recursive unfold - brief parser just extracts)
      const result = await parseBrief(briefText);
      
      // Check if we should redirect to agent chat
      if (result.isRedirectToAgent) {
        setParsedBrief(result);
        setParseState('redirect');
        return;
      }
      
      setParsedBrief(result);
      
      // Select all parsed areas by default
      setSelectedAreas(new Set(result.areas.map((_, i) => i)));
      setSelectedSuggested(new Set());
      
      setParseState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse brief');
      setParseState('error');
    }
  };
  
  const toggleArea = (index: number) => {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  
  const toggleSuggested = (index: number) => {
    setSelectedSuggested((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  
  const handleApply = async () => {
    if (!parsedBrief) return;
    
    const areasToCreate: ParsedBriefArea[] = [
      ...parsedBrief.areas.filter((_, i) => selectedAreas.has(i)),
      ...(parsedBrief.suggestedAreas || []).filter((_, i) => selectedSuggested.has(i)),
    ];
    
    if (areasToCreate.length === 0) {
      setError('No areas selected');
      return;
    }
    
    // Snapshot before creating
    snapshot('parse-brief', `Parse brief: ${areasToCreate.length} areas`, { nodes, groups });
    
    // Create areas and collect IDs
    const createdNodeIds: string[] = [];
    areasToCreate.forEach((area) => {
      const id = createNode({
        name: area.name,
        areaPerUnit: area.areaPerUnit,
        count: area.count,
        briefNote: area.briefNote,  // Pass brief notes (comments from brief)
        aiNote: area.aiNote,        // Pass AI notes (if generated)
      });
      if (id) createdNodeIds.push(id);
    });
    
    // Set project context
    const contextText = parsedBrief.projectContext || '';
    if (contextText) {
      setProjectContext(contextText);
    }
    
    addSystemMessage(`Created ${areasToCreate.length} areas from brief`, 'success');
    
    // Auto-organize into groups if enabled
    if (autoOrganize && createdNodeIds.length > 0) {
      setParseState('organizing');
      
      // Check if brief has detected group structure
      const hasDetectedGroups = parsedBrief.hasGroupStructure && 
        parsedBrief.detectedGroups && 
        parsedBrief.detectedGroups.length > 0;
      
      if (hasDetectedGroups) {
        // Use the group structure from the brief
        try {
          const currentNodes = useProjectStore.getState().nodes;
          
          // Build a map of area name -> node ID for matching
          const nameToNodeId: Record<string, string> = {};
          createdNodeIds.forEach(id => {
            const node = currentNodes[id];
            if (node) {
              nameToNodeId[node.name.toLowerCase()] = id;
            }
          });
          
          let groupsCreated = 0;
          for (const detectedGroup of parsedBrief.detectedGroups!) {
            // Find matching node IDs for this group
            const memberIds = detectedGroup.areaNames
              .map(name => nameToNodeId[name.toLowerCase()])
              .filter(Boolean);
            
            if (memberIds.length > 0) {
              const groupId = createGroup({
                name: detectedGroup.name,
                color: detectedGroup.color,
              });
              
              if (groupId) {
                assignToGroup(groupId, memberIds);
                groupsCreated++;
              }
            }
          }
          
          if (groupsCreated > 0) {
            addSystemMessage(`Created ${groupsCreated} groups from brief structure`, 'success');
          }
        } catch (err) {
          console.error('Failed to create groups from brief:', err);
          addSystemMessage('Created areas but could not apply group structure', 'warning');
        }
      } else {
        // No group structure in brief - ask AI to propose groups
        try {
          const currentNodes = useProjectStore.getState().nodes;
          const currentGroups = useProjectStore.getState().groups;
          const newNodes = createdNodeIds.map(id => currentNodes[id]).filter(Boolean);
          
          const request = buildChatRequest(
            'Organize these areas into logical functional groups. Create groups with appropriate names and colors.',
            contextText,
            newNodes,
            [],
            currentNodes,
            currentGroups,
            { mode: 'agent', contextLevel: 'standard' }
          );
          
          const response = await sendChatMessage(request, 'agent');
          
          if (response.proposals && response.proposals.length > 0) {
            const proposals = addIdsToProposals(response.proposals);
            addAIMessage(response.message, proposals);
            addSystemMessage('AI proposed groups for your areas. Review in chat.', 'info');
          }
        } catch (err) {
          console.error('Auto-organize failed:', err);
          addSystemMessage('Could not auto-organize. You can organize manually.', 'warning');
        }
      }
    }
    
    // Switch back to chat mode
    setBriefMode(false);
    setBriefText('');
    setParsedBrief(null);
    setParseState('input');
    setAutoOrganize(false);
  };
  
  const handleCancel = () => {
    setParseState('input');
    setParsedBrief(null);
    setError(null);
  };
  
  if (parseState === 'parsing') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Parsing brief...</p>
        <p className="text-xs text-muted-foreground">Extracting areas and generating context</p>
      </div>
    );
  }
  
  if (parseState === 'redirect') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <Wand2 className="w-8 h-8 text-primary" />
        <h3 className="text-lg font-medium">Generation Request Detected</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Your input looks like a request to generate a building program, not a brief to parse.
        </p>
        <div className="text-xs text-muted-foreground space-y-1 text-center">
          <p>• Brief Parser extracts areas from existing documents</p>
          <p>• Agent Chat generates programs from prompts</p>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={handleCancel}>
            <X className="w-4 h-4 mr-2" />
            Back to Brief
          </Button>
          <Button onClick={() => {
            setBriefMode(false);
            // Copy the text to agent chat (via briefText which can be used)
          }}>
            <Wand2 className="w-4 h-4 mr-2" />
            Switch to Agent Chat
          </Button>
        </div>
      </div>
    );
  }
  
  if (parseState === 'organizing') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <FolderTree className="w-8 h-8 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground">Organizing into groups...</p>
        <p className="text-xs text-muted-foreground">AI is proposing logical groupings</p>
      </div>
    );
  }
  
  if (parseState === 'preview' && parsedBrief) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {/* Extracted Areas */}
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Extracted Areas ({parsedBrief.areas.length})
              </h3>
              <div className="space-y-2">
                {parsedBrief.areas.map((area, i) => (
                  <AreaPreviewCard
                    key={i}
                    area={area}
                    selected={selectedAreas.has(i)}
                    onToggle={() => toggleArea(i)}
                  />
                ))}
              </div>
            </div>
            
            {/* Suggested Areas */}
            {parsedBrief.suggestedAreas && parsedBrief.suggestedAreas.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Suggestions ({parsedBrief.suggestedAreas.length})
                </h3>
                <div className="space-y-2">
                  {parsedBrief.suggestedAreas.map((area, i) => (
                    <AreaPreviewCard
                      key={i}
                      area={area}
                      selected={selectedSuggested.has(i)}
                      onToggle={() => toggleSuggested(i)}
                      isSuggestion
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Detected Groups from Brief */}
            {parsedBrief.hasGroupStructure && parsedBrief.detectedGroups && parsedBrief.detectedGroups.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  Detected Groups ({parsedBrief.detectedGroups.length})
                </h3>
                <div className="space-y-2">
                  {parsedBrief.detectedGroups.map((group, i) => (
                    <div 
                      key={i} 
                      className="text-xs p-2 rounded border border-border bg-muted/30"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="font-medium">{group.name}</span>
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {group.areaNames.length} areas
                        </Badge>
                      </div>
                      <p className="text-muted-foreground truncate">
                        {group.areaNames.slice(0, 4).join(', ')}
                        {group.areaNames.length > 4 && ` +${group.areaNames.length - 4} more`}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  ✓ Groups will be created automatically from brief structure
                </p>
              </div>
            )}
            
            {/* Area Totals Validation */}
            {(parsedBrief.briefTotal || parsedBrief.parsedTotal || parsedBrief.groupTotals?.length) && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-500" />
                  Area Validation
                </h3>
                <div className="space-y-2 text-xs">
                  {/* Program Total */}
                  {(() => {
                    const calculated = parsedBrief.parsedTotal ?? 
                      parsedBrief.areas.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
                    const stated = parsedBrief.briefTotal;
                    const diff = stated ? Math.abs(calculated - stated) : 0;
                    const tolerance = stated ? stated * 0.02 : 0; // 2% tolerance
                    const isMatch = !stated || diff <= tolerance;
                    
                    return (
                      <div className={`p-2 rounded border ${isMatch ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                        <div className="flex items-center gap-2">
                          {isMatch ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="font-medium">Program Total</span>
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="text-muted-foreground">Parsed:</span>
                          <span className="font-mono">{calculated.toLocaleString()} m²</span>
                        </div>
                        {stated && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Brief states:</span>
                              <span className="font-mono">{stated.toLocaleString()} m²</span>
                            </div>
                            {!isMatch && (
                              <div className="flex justify-between text-amber-600">
                                <span>Difference:</span>
                                <span className="font-mono">{diff > 0 ? '+' : ''}{(calculated - stated).toLocaleString()} m²</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Group Totals */}
                  {parsedBrief.groupTotals && parsedBrief.groupTotals.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Group subtotals:</span>
                      {parsedBrief.groupTotals.map((gt, i) => {
                        const diff = Math.abs(gt.parsedTotal - gt.statedTotal);
                        const tolerance = gt.statedTotal * 0.02;
                        const isMatch = diff <= tolerance;
                        
                        return (
                          <div key={i} className="flex items-center justify-between pl-2">
                            <span className="truncate flex-1">{gt.groupName}</span>
                            <div className="flex items-center gap-2">
                              {isMatch ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              ) : (
                                <XCircle className="w-3 h-3 text-amber-500" />
                              )}
                              <span className="font-mono text-xs">
                                {gt.parsedTotal.toLocaleString()}
                                {!isMatch && (
                                  <span className="text-amber-500"> (brief: {gt.statedTotal.toLocaleString()})</span>
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Ambiguities */}
            {parsedBrief.ambiguities && parsedBrief.ambiguities.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Notes
                </h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {parsedBrief.ambiguities.map((note, i) => (
                    <li key={i}>• {note}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Context Preview */}
            {parsedBrief.projectContext && (
              <div>
                <h3 className="text-sm font-medium mb-2">Project Context</h3>
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  {parsedBrief.projectContext}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-border flex-shrink-0 space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded -mx-2">
            <input
              type="checkbox"
              checked={autoOrganize}
              onChange={(e) => setAutoOrganize(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-primary accent-primary"
            />
            <FolderTree className="w-4 h-4 text-primary" />
            <span>
              {parsedBrief.hasGroupStructure && parsedBrief.detectedGroups?.length
                ? 'Apply groups from brief'
                : 'Auto-organize into groups (AI)'}
            </span>
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={handleApply} className="flex-1">
              <Plus className="w-4 h-4 mr-1" />
              Create {selectedAreas.size + selectedSuggested.size} Areas
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Input state
  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="font-medium">Parse Brief</h3>
      </div>
      
      <p className="text-xs text-muted-foreground mb-4 flex-shrink-0">
        Paste your project brief below. The AI will extract areas,
        suggest additional spaces, and generate a project context.
      </p>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        <Textarea
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          placeholder="Paste project brief here...

Example:
- Lobby: 150 sqm
- Open office: 500 sqm for 50 people
- Meeting rooms: 4 rooms × 25 sqm each
- Executive offices: 3 × 30 sqm"
          className="h-full w-full resize-none"
        />
      </div>
      
      {/* Input Classification Preview */}
      {inputClassification && briefText.trim().length > 10 && (
        <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 flex-shrink-0 space-y-2">
          {/* Type and Strategy */}
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const TypeIcon = getInputTypeIcon(inputClassification.type);
              return (
                <>
                  <TypeIcon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {getInputTypeDescription(inputClassification.type)}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getQualityColor(inputClassification.quality)}`}
                  >
                    {inputClassification.quality} quality
                  </Badge>
                </>
              );
            })()}
          </div>
          
          {/* Strategy description */}
          <p className="text-xs text-muted-foreground">
            {getStrategyDescription(inputClassification.strategy)}
          </p>
          
          {/* Warnings */}
          {inputClassification.warnings.length > 0 && (
            <div className="space-y-1">
              {inputClassification.warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Suggestions for low quality */}
          {inputClassification.quality === 'low' && inputClassification.suggestions.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border">
              {inputClassification.suggestions.slice(0, 2).map((suggestion, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-blue-600">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Stats for structured briefs */}
          {inputClassification.type === 'structured' && (
            <div className="flex gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
              <span>Lines: {inputClassification.signals.lineCount}</span>
              <span>Numbers: {inputClassification.signals.numericCount}</span>
              {inputClassification.signals.hasTotals && (
                <span className="text-green-600">✓ Has totals</span>
              )}
              {inputClassification.signals.hasSectionHeaders && (
                <span className="text-green-600">✓ Has headers</span>
              )}
            </div>
          )}
        </div>
      )}
      
      {error && (
        <p className="text-xs text-destructive mt-2 flex-shrink-0">{error}</p>
      )}
      
      <Button 
        onClick={handleParse} 
        disabled={!briefText.trim() || inputClassification?.strategy === 'reject'}
        className="mt-4"
      >
        {inputClassification?.strategy === 'redirect_to_agent' ? (
          <>
            <Wand2 className="w-4 h-4 mr-1" />
            Generate Program
          </>
        ) : inputClassification?.strategy === 'reject' ? (
          <>
            <Ban className="w-4 h-4 mr-1" />
            Cannot Parse
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-1" />
            Parse Brief
          </>
        )}
      </Button>
    </div>
  );
}

interface AreaPreviewCardProps {
  area: ParsedBriefArea;
  selected: boolean;
  onToggle: () => void;
  isSuggestion?: boolean;
}

function AreaPreviewCard({ area, selected, onToggle, isSuggestion }: AreaPreviewCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'opacity-50'
      }`}
      onClick={onToggle}
    >
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
              selected ? 'bg-primary border-primary' : 'border-muted-foreground'
            }`}>
              {selected && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
            {area.name}
            {isSuggestion && (
              <Badge variant="secondary" className="text-xs">AI</Badge>
            )}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {area.count} × {area.areaPerUnit}m²
          </span>
        </div>
      </CardHeader>
      {(area.briefNote || area.aiNote) && (
        <CardContent className="py-0 pb-2 px-3">
          <p className="text-xs text-muted-foreground pl-6">
            {area.briefNote || area.aiNote}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
