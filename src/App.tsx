import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/layout';
import { AreaInspector } from '@/components/area-tools';
import { GroupInspector } from '@/components/group-tools';
import { ChatPanel } from '@/components/chat';
import { AreaBoard } from '@/components/board';
import { useProjectStore, useHistoryStore, useUIStore } from '@/stores';
import { useEffect } from 'react';

function App() {
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Inspector */}
        <aside className="w-80 border-r border-border bg-card flex flex-col">
          {selectedNodeIds.length > 0 ? (
            <AreaInspector />
          ) : selectedGroupIds.length > 0 ? (
            <GroupInspector />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
              Select an area or group to inspect
            </div>
          )}
        </aside>

        {/* Center - Area Board */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AreaBoard />
        </div>

        {/* Right Panel - AI Chat */}
        <ChatPanel />
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
