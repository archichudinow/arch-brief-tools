import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/layout';
import { AreaInspector } from '@/components/area-tools';
import { GroupInspector } from '@/components/group-tools';
import { ChatPanel } from '@/components/chat';
import { AreaBoard } from '@/components/board';
import { useProjectStore, useHistoryStore, useUIStore } from '@/stores';
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

function App() {
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  const leftPanelCollapsed = useUIStore((s) => s.leftPanelCollapsed);
  const rightPanelCollapsed = useUIStore((s) => s.rightPanelCollapsed);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);

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
      // Skip if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Delete: Delete or Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const uiState = useUIStore.getState();
        const projectState = useProjectStore.getState();
        
        if (uiState.selectedNodeIds.length > 0) {
          e.preventDefault();
          const count = uiState.selectedNodeIds.length;
          
          // Snapshot before deletion
          useHistoryStore.getState().snapshot(
            'delete-areas',
            `Delete ${count} area${count > 1 ? 's' : ''}`,
            { nodes: projectState.nodes, groups: projectState.groups }
          );
          
          // Delete all selected nodes
          uiState.selectedNodeIds.forEach(id => {
            projectState.deleteNode(id);
          });
          
          uiState.clearSelection();
          toast.success(`Deleted ${count} area${count > 1 ? 's' : ''}`);
        } else if (uiState.selectedGroupIds.length > 0) {
          e.preventDefault();
          const count = uiState.selectedGroupIds.length;
          
          // Snapshot before deletion
          useHistoryStore.getState().snapshot(
            'delete-groups',
            `Delete ${count} group${count > 1 ? 's' : ''}`,
            { nodes: projectState.nodes, groups: projectState.groups }
          );
          
          // Delete all selected groups
          uiState.selectedGroupIds.forEach(id => {
            projectState.deleteGroup(id);
          });
          
          uiState.clearSelection();
          toast.success(`Deleted ${count} group${count > 1 ? 's' : ''}`);
        }
      }

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

      <main className="flex-1 flex overflow-hidden relative">
        {/* Left Panel - Inspector */}
        {!leftPanelCollapsed && (
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
        )}

        {/* Left Panel Toggle */}
        <button
          className={`absolute top-1/2 -translate-y-1/2 z-50 h-16 w-3 flex items-center justify-center rounded-r transition-opacity bg-muted/80 hover:bg-muted ${leftPanelCollapsed ? 'opacity-60 hover:opacity-100' : 'opacity-0 hover:opacity-100'}`}
          style={{ left: leftPanelCollapsed ? 0 : 'calc(20rem - 1px)' }}
          onClick={toggleLeftPanel}
          title={leftPanelCollapsed ? 'Show inspector' : 'Hide inspector'}
        >
          {leftPanelCollapsed ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          )}
        </button>

        {/* Center - Area Board */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AreaBoard />
        </div>

        {/* Right Panel Toggle */}
        <button
          className={`absolute top-1/2 -translate-y-1/2 z-50 h-16 w-3 flex items-center justify-center rounded-l transition-opacity bg-muted/80 hover:bg-muted ${rightPanelCollapsed ? 'opacity-60 hover:opacity-100' : 'opacity-0 hover:opacity-100'}`}
          style={{ right: rightPanelCollapsed ? 0 : 'calc(24rem - 1px)' }}
          onClick={toggleRightPanel}
          title={rightPanelCollapsed ? 'Show AI chat' : 'Hide AI chat'}
        >
          {rightPanelCollapsed ? (
            <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>

        {/* Right Panel - AI Chat */}
        {!rightPanelCollapsed && <ChatPanel />}
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;