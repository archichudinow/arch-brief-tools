import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useChatStore, useProjectStore, useHistoryStore } from '@/stores';
import { parseBrief } from '@/services';
import type { ParsedBrief, ParsedBriefArea } from '@/types';
import { 
  FileText, 
  Loader2, 
  Check, 
  X, 
  AlertTriangle,
  Plus,
  Sparkles
} from 'lucide-react';

type ParseState = 'input' | 'parsing' | 'preview' | 'error';

export function BriefInput() {
  const briefText = useChatStore((s) => s.briefText);
  const setBriefText = useChatStore((s) => s.setBriefText);
  const setProjectContext = useChatStore((s) => s.setProjectContext);
  const addSystemMessage = useChatStore((s) => s.addSystemMessage);
  const setBriefMode = useChatStore((s) => s.setBriefMode);
  
  const createNode = useProjectStore((s) => s.createNode);
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const snapshot = useHistoryStore((s) => s.snapshot);
  
  const [parseState, setParseState] = useState<ParseState>('input');
  const [parsedBrief, setParsedBrief] = useState<ParsedBrief | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<Set<number>>(new Set());
  const [selectedSuggested, setSelectedSuggested] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  const handleParse = async () => {
    if (!briefText.trim()) return;
    
    setParseState('parsing');
    setError(null);
    
    try {
      const result = await parseBrief(briefText);
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
  
  const handleApply = () => {
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
    
    // Create areas
    areasToCreate.forEach((area) => {
      createNode({
        name: area.name,
        areaPerUnit: area.areaPerUnit,
        count: area.count,
        userNote: area.briefNote || area.aiNote,
      });
    });
    
    // Set project context
    if (parsedBrief.projectContext) {
      setProjectContext(parsedBrief.projectContext);
    }
    
    addSystemMessage(`Created ${areasToCreate.length} areas from brief`, 'success');
    
    // Switch back to chat mode
    setBriefMode(false);
    setBriefText('');
    setParsedBrief(null);
    setParseState('input');
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
        
        <div className="p-4 flex gap-2 border-t border-border flex-shrink-0">
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
      
      {error && (
        <p className="text-xs text-destructive mt-2 flex-shrink-0">{error}</p>
      )}
      
      <Button 
        onClick={handleParse} 
        disabled={!briefText.trim()}
        className="mt-4"
      >
        <Sparkles className="w-4 h-4 mr-1" />
        Parse Brief
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
