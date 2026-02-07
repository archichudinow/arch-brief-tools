import { useProjectStore, useHistoryStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Upload,
  MoreVertical,
  Undo2,
  Redo2,
  FilePlus,
  Sun,
  Moon,
  Monitor,
  FileSpreadsheet,
  Box,
  ChevronDown,
  FolderOpen,
  LayoutGrid,
  Layers,
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const { setTheme } = useTheme();
  
  // View state from global store
  const boardViewMode = useUIStore((s) => s.boardViewMode);
  const setBoardViewMode = useUIStore((s) => s.setBoardViewMode);

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
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-3 gap-4">
      {/* Left: Logo & Project Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-primary-foreground font-bold text-xs">AB</span>
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
            className="w-40 h-7 text-sm"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-sm font-medium hover:text-primary transition-colors truncate max-w-[160px]"
            title={projectName}
          >
            {projectName}
          </button>
        )}
        
        {/* Undo/Redo - near project name */}
        <div className="flex items-center border-l border-border pl-3 ml-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Center: View Switcher */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
        <Button
          variant={boardViewMode === 'areas' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setBoardViewMode('areas')}
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
          Board
        </Button>
        <Button
          variant={boardViewMode === 'levels' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setBoardViewMode('levels')}
          title="Program stack per level"
        >
          <Layers className="h-3.5 w-3.5 mr-1.5" />
          Levels
        </Button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* File menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              File
              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleNewProject}>
              <FilePlus className="h-4 w-4 mr-2" />
              New Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import JSON...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Export</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />
              JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportGLB}>
              <Box className="h-4 w-4 mr-2" />
              GLB (3D)
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

        {/* Settings/Theme */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Theme</DropdownMenuLabel>
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
      </div>
    </header>
  );
}
