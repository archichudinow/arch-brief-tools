import { useProjectStore, useHistoryStore, useChatStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Upload,
  Settings,
  MoreVertical,
  Undo2,
  Redo2,
  FilePlus,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  FileSpreadsheet,
  Box,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { exportToExcel } from '@/lib/exportExcel';
import { exportToGLB } from '@/lib/exportGLB';

export function Header() {
  const projectName = useProjectStore((s) => s.meta.name);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const exportProject = useProjectStore((s) => s.exportProject);
  const importProject = useProjectStore((s) => s.importProject);
  const resetProject = useProjectStore((s) => s.resetProject);
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const boardLayout = useProjectStore((s) => s.boardLayout);

  const canUndo = useHistoryStore((s) => s.canUndo());
  const canRedo = useHistoryStore((s) => s.canRedo());
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  
  const isOpen = useChatStore((s) => s.isOpen);
  const toggleChat = useChatStore((s) => s.toggleChat);
  const pendingProposals = useChatStore((s) => s.pendingProposals);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleExportJSON = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.archbrief.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Project exported as JSON');
  };

  const handleExportExcel = async () => {
    try {
      await exportToExcel({ projectName, nodes, groups });
      toast.success('Project exported as Excel');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export Excel file');
    }
  };

  const handleExportGLB = async () => {
    try {
      await exportToGLB({ projectName, nodes, groups, boardLayout });
      toast.success('Project exported as GLB');
    } catch (error) {
      console.error('GLB export error:', error);
      toast.error('Failed to export GLB file');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const success = importProject(json);
      if (success) {
        toast.success('Project imported');
      } else {
        toast.error('Failed to import project');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUndo = () => {
    const data = undo();
    if (data) {
      useProjectStore.setState({
        nodes: data.nodes,
        groups: data.groups,
      });
      toast.info('Undo');
    }
  };

  const handleRedo = () => {
    const data = redo();
    if (data) {
      useProjectStore.setState({
        nodes: data.nodes,
        groups: data.groups,
      });
      toast.info('Redo');
    }
  };

  const handleNewProject = () => {
    if (Object.keys(nodes).length > 0) {
      if (!confirm('Create new project? Unsaved changes will be lost.')) {
        return;
      }
    }
    resetProject();
    toast.success('New project created');
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      {/* Left: Theme Toggle & Logo & Project Name */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : theme === 'light' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="h-4 w-4 mr-2" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="h-4 w-4 mr-2" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">AB</span>
          </div>
          {isEditingName ? (
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditingName(false);
                }
              }}
              className="w-48 h-8"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {projectName}
            </button>
          )}
        </div>
      </div>

      {/* Center: Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant={isOpen ? 'default' : 'outline'}
          size="sm"
          onClick={toggleChat}
          className="relative"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI Chat
          {pendingProposals.length > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {pendingProposals.length}
            </Badge>
          )}
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportGLB}>
              <Box className="h-4 w-4 mr-2" />
              Export GLB (3D)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.archbrief.json"
          onChange={handleImport}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleNewProject}>
              <FilePlus className="h-4 w-4 mr-2" />
              New Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
