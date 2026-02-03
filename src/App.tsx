import { Toaster } from '@/components/ui/sonner';
import { Header, StepBar, AreaGroupPanel } from '@/components/layout';
import { AreaTree, AreaInspector } from '@/components/area-tools';
import { GroupInspector } from '@/components/group-tools';
import { ChatPanel } from '@/components/chat';
import { useProjectStore, useHistoryStore, useUIStore, useChatStore } from '@/stores';
import { useEffect } from 'react';

function App() {
  const currentStep = useProjectStore((s) => s.meta.currentStep);
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  const isChatOpen = useChatStore((s) => s.isOpen);
  const toggleChat = useChatStore((s) => s.toggleChat);
  const closeChat = useChatStore((s) => s.closeChat);

  // Initialize history with initial state
  useEffect(() => {
    const historyState = useHistoryStore.getState();
    if (historyState.snapshots.length === 0) {
      historyState.snapshot('initial', 'Initial state', {
        nodes,
        groups,
      });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const data = useHistoryStore.getState().undo();
        if (data) {
          useProjectStore.setState({
            nodes: data.nodes,
            groups: data.groups,
          });
        }
      }
      // Redo: Cmd+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        const data = useHistoryStore.getState().redo();
        if (data) {
          useProjectStore.setState({
            nodes: data.nodes,
            groups: data.groups,
          });
        }
      }
      // Toggle AI Chat: Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleChat();
      }
      // Close chat: Escape
      if (e.key === 'Escape' && isChatOpen) {
        closeChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, toggleChat, closeChat]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <StepBar />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Areas & Groups Side by Side */}
        <aside className="w-[520px] border-r border-border bg-card flex flex-col">
          {currentStep >= 1 && currentStep < 2 && <AreaTree />}
          {currentStep >= 2 && <AreaGroupPanel />}
        </aside>

        {/* Center - Future canvas/3D */}
        <div className="flex-1 flex items-center justify-center bg-muted/20">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Step {currentStep}: {getStepLabel(currentStep)}</p>
            <p className="text-sm mt-1">
              {currentStep === 0 && 'Paste brief or upload files'}
              {currentStep === 1 && 'Create and organize areas'}
              {currentStep === 2 && 'Group areas into programs'}
              {currentStep === 3 && '3D massing visualization'}
            </p>
          </div>
        </div>

        {/* Right Panel - Inspector */}
        <aside className="w-80 border-l border-border bg-card flex flex-col">
          {currentStep >= 1 && currentStep < 2 && <AreaInspector />}
          {currentStep >= 2 && (
            <>
              {selectedNodeIds.length > 0 ? (
                <AreaInspector />
              ) : selectedGroupIds.length > 0 ? (
                <GroupInspector />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
                  Select an area or group to inspect
                </div>
              )}
            </>
          )}
        </aside>
        
        {/* AI Chat Panel */}
        <ChatPanel />
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

function getStepLabel(step: number): string {
  switch (step) {
    case 0: return 'Input';
    case 1: return 'Areas';
    case 2: return 'Groups';
    case 3: return 'Massing';
    default: return '';
  }
}

export default App;
