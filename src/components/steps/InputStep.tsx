import { useState, useRef, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { FileSpreadsheet, Sparkles, Loader2, AlertCircle, X, CheckCircle, Download, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseBrief, refineBrief, isOpenAIConfigured } from '@/lib/openai';
import { parseExcelFile, type ParsedExcelData } from '@/lib/excel';
import { ChatPanel, type AttachedItem } from '@/components/chat/ChatPanel';
import type { ChatMessage, ProgramItem } from '@/types';

export function InputStep() {
  const { state, dispatch } = useApp();
  const { textBrief } = state.input.raw;
  const { siteArea, maxHeight, maxFootprintRatio } = state.input.site;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [excelParsed, setExcelParsed] = useState<ParsedExcelData | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<AttachedItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current programs for chat context
  const currentPrograms: ProgramItem[] = state.normalized?.items ?? [];

  const handleParseBrief = async () => {
    if (!textBrief.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await parseBrief(textBrief);
      
      dispatch({
        type: 'SET_NORMALIZED_PROGRAM',
        payload: {
          programs: result.programs,
          assumptions: result.assumptions,
          siteParams: result.siteParams,
        },
      });
      
      // After parsing, show chat for refinement
      setShowChat(true);
      setChatMessages([{
        id: 'initial',
        role: 'assistant',
        content: `I've parsed ${result.programs.length} programs from your brief. You can ask me to add more rooms, modify areas, or adjust any details.`,
        timestamp: new Date(),
      }]);
      
      dispatch({ type: 'COMPLETE_STEP', payload: 'input' });
      dispatch({ type: 'SET_STEP', payload: 'normalize' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse brief');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSend = useCallback(async (message: string, attachedItems: AttachedItem[]) => {
    // Add user message to chat
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
    
    try {
      const attachedProgramIds = attachedItems
        .filter(i => i.type === 'program')
        .map(i => i.id);
      
      const result = await refineBrief(currentPrograms, message, attachedProgramIds);
      
      // Update programs with refined data
      dispatch({
        type: 'SET_NORMALIZED_PROGRAM',
        payload: {
          programs: result.programs,
          assumptions: result.assumptions ?? state.normalized?.assumptions ?? [],
        },
      });
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Done! Updated the program list. Now showing ${result.programs.length} programs.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I couldn't process that: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [currentPrograms, dispatch, state.normalized?.assumptions]);

  const handleSelectItem = useCallback((item: AttachedItem) => {
    setSelectedItems(prev => {
      if (prev.find(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setExcelFileName(file.name);
    setError(null);
    
    try {
      const result = await parseExcelFile(file);
      setExcelParsed(result);
      
      // If we got programs from Excel, use them directly
      if (result.programs.length > 0) {
        dispatch({
          type: 'SET_NORMALIZED_PROGRAM',
          payload: {
            programs: result.programs.map((p, i) => ({
              id: p.id || `excel-${i + 1}`,
              name: p.name || 'Unknown',
              area: p.area || 0,
              quantity: p.quantity || 1,
              totalArea: (p.area || 0) * (p.quantity || 1),
              unit: p.unit || 'sqm',
              areaType: p.areaType || 'unknown',
              confidence: p.confidence || 0.7,
              source: 'excel' as const,
              aiNotes: '', // Will be filled by AI during grouping
            })),
            assumptions: [{
              id: 'excel-import',
              field: 'Excel Import',
              assumedValue: file.name,
              reasoning: `Data imported from Excel file. ${result.programs.length} programs detected.`,
              accepted: false,
            }],
          },
        });
        
        // Show chat for refinement after Excel import
        setShowChat(true);
        setChatMessages([{
          id: 'excel-import',
          role: 'assistant',
          content: `Imported ${result.programs.length} programs from Excel. You can ask me to add more rooms or modify any details.`,
          timestamp: new Date(),
        }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
      setExcelParsed(null);
    }
  };

  const clearExcelFile = () => {
    setExcelFileName(null);
    setExcelParsed(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const apiConfigured = isOpenAIConfigured();

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Project Brief Input</h1>
        <p className="text-muted-foreground mt-1">
          Paste your architectural brief or upload an Excel file with program data.
        </p>
      </div>

      {/* Text Brief */}
      <section className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Text Brief</span>
          <textarea
            value={textBrief}
            onChange={(e) => dispatch({ type: 'SET_TEXT_BRIEF', payload: e.target.value })}
            placeholder="Paste your architectural brief here...

Example:
- Residential: 5,000 sqm (apartments, 80-120 sqm each)
- Retail: 1,200 sqm (ground floor, street access required)
- Office: 3,000 sqm (flexible floor plates)
- Parking: 150 spaces underground
- Site area: 2,500 sqm
- Max height: 45m"
            className={cn(
              'mt-2 w-full h-64 px-4 py-3 rounded-lg',
              'bg-input border border-border',
              'text-sm resize-none',
              'placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
          />
        </label>
      </section>

      {/* Excel Upload */}
      <section className="space-y-3">
        <span className="text-sm font-medium">Excel Program Table (Optional)</span>
        {excelParsed && excelFileName ? (
          <div className={cn(
            'border border-green-600/50 bg-green-950/20 rounded-lg p-4',
            'flex items-center justify-between'
          )}>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">{excelFileName}</p>
                <p className="text-xs text-muted-foreground">
                  {excelParsed.programs.length} programs parsed successfully
                </p>
              </div>
            </div>
            <button
              onClick={clearExcelFile}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed border-border rounded-lg p-8',
              'flex flex-col items-center justify-center',
              'hover:border-muted-foreground/50 transition-colors cursor-pointer'
            )}
          >
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Drag & drop an Excel file, or click to browse
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              .xlsx, .xls supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
            />
          </div>
        )}
      </section>

      {/* Site Parameters */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium">Site Parameters (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs text-muted-foreground">Site Area (sqm)</span>
            <input
              type="number"
              value={siteArea ?? ''}
              onChange={(e) => dispatch({ 
                type: 'SET_SITE_PARAMS', 
                payload: { siteArea: e.target.value ? Number(e.target.value) : undefined }
              })}
              placeholder="e.g. 2500"
              className={cn(
                'mt-1 w-full px-3 py-2 rounded-md',
                'bg-input border border-border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Max Height (m)</span>
            <input
              type="number"
              value={maxHeight ?? ''}
              onChange={(e) => dispatch({ 
                type: 'SET_SITE_PARAMS', 
                payload: { maxHeight: e.target.value ? Number(e.target.value) : undefined }
              })}
              placeholder="e.g. 45"
              className={cn(
                'mt-1 w-full px-3 py-2 rounded-md',
                'bg-input border border-border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Max Footprint (%)</span>
            <input
              type="number"
              value={maxFootprintRatio ? maxFootprintRatio * 100 : ''}
              onChange={(e) => dispatch({ 
                type: 'SET_SITE_PARAMS', 
                payload: { maxFootprintRatio: e.target.value ? Number(e.target.value) / 100 : undefined }
              })}
              placeholder="e.g. 60"
              className={cn(
                'mt-1 w-full px-3 py-2 rounded-md',
                'bg-input border border-border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}
            />
          </label>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* API Key Warning */}
      {!apiConfigured && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-yellow-500/10 text-yellow-500">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">
            OpenAI API key not configured. Add <code className="bg-muted px-1 rounded">VITE_OPENAI_API_KEY</code> to <code className="bg-muted px-1 rounded">.env.local</code>
          </p>
        </div>
      )}

      {/* Actions */}
      <section className="flex items-center gap-4 pt-4 border-t border-border">
        <button
          onClick={handleParseBrief}
          disabled={!textBrief.trim() || isLoading || !apiConfigured}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg',
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
          {isLoading ? 'Parsing...' : 'Read Brief with AI'}
        </button>
        
        {currentPrograms.length > 0 && (
          <button
            onClick={() => setShowChat(!showChat)}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg',
              'bg-secondary text-secondary-foreground font-medium',
              'hover:bg-secondary/80 transition-colors',
              showChat && 'bg-primary/20'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            {showChat ? 'Hide Chat' : 'Refine with Chat'}
          </button>
        )}
        
        <button
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg',
            'bg-secondary text-secondary-foreground font-medium',
            'hover:bg-secondary/80 transition-colors'
          )}
        >
          <Download className="w-4 h-4" />
          Export Raw JSON
        </button>
      </section>

      {/* Chat Panel for Refinement */}
      {showChat && currentPrograms.length > 0 && (
        <section className="mt-6">
          <ChatPanel
            mode="refine-brief"
            messages={chatMessages}
            onSend={handleChatSend}
            isLoading={isChatLoading}
            programs={currentPrograms}
            selectedItems={selectedItems}
            onSelectItem={handleSelectItem}
            onRemoveItem={handleRemoveItem}
            placeholder="Add rooms, change areas, or ask questions..."
          />
        </section>
      )}
    </div>
  );
}
