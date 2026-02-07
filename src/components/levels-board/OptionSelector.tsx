import { useState } from 'react';
import { useLevelsStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Plus, Copy, Trash2, Check, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export function OptionSelector() {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  
  const options = useLevelsStore((s) => s.options);
  const activeOptionId = useLevelsStore((s) => s.activeOptionId);
  const createOption = useLevelsStore((s) => s.createOption);
  const duplicateOption = useLevelsStore((s) => s.duplicateOption);
  const deleteOption = useLevelsStore((s) => s.deleteOption);
  const setActiveOption = useLevelsStore((s) => s.setActiveOption);
  const renameOption = useLevelsStore((s) => s.renameOption);
  const getOptions = useLevelsStore((s) => s.getOptions);
  
  const optionsList = getOptions();
  const activeOption = activeOptionId ? options[activeOptionId] : null;
  
  const handleCreateOption = () => {
    const name = `Option ${optionsList.length + 1}`;
    const id = createOption(name);
    setActiveOption(id);
    toast.success(`Created "${name}"`);
  };
  
  const handleDuplicateOption = () => {
    if (!activeOptionId) return;
    const id = duplicateOption(activeOptionId);
    if (id) {
      setActiveOption(id);
      toast.success('Option duplicated');
    }
  };
  
  const handleDeleteOption = () => {
    if (!activeOptionId) return;
    if (optionsList.length <= 1) {
      toast.error('Cannot delete the last option');
      return;
    }
    const name = activeOption?.name || 'Option';
    if (confirm(`Delete "${name}"? This will remove all levels and sections in this option.`)) {
      deleteOption(activeOptionId);
      toast.success(`Deleted "${name}"`);
    }
  };
  
  const handleStartRename = () => {
    if (!activeOption) return;
    setRenameValue(activeOption.name);
    setIsRenaming(true);
  };
  
  const handleConfirmRename = () => {
    if (!activeOptionId || !renameValue.trim()) return;
    renameOption(activeOptionId, renameValue.trim());
    setIsRenaming(false);
    toast.success('Option renamed');
  };
  
  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameValue('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };
  
  // If no options exist yet, show a "Create Option" button
  if (optionsList.length === 0) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleCreateOption}
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        Create Option
      </Button>
    );
  }
  
  // Rename mode
  if (isRenaming) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 w-40 text-sm"
          autoFocus
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleConfirmRename}
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleCancelRename}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-w-[140px] justify-between">
          <span className="truncate">{activeOption?.name || 'Select Option'}</span>
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* Option list */}
        {optionsList.map((opt) => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => setActiveOption(opt.id)}
            className={opt.id === activeOptionId ? 'bg-accent' : ''}
          >
            <span className="truncate flex-1">{opt.name}</span>
            {opt.id === activeOptionId && <Check className="w-4 h-4 ml-2" />}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Actions */}
        <DropdownMenuItem onClick={handleCreateOption}>
          <Plus className="w-4 h-4 mr-2" />
          New Option
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDuplicateOption} disabled={!activeOptionId}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleStartRename} disabled={!activeOptionId}>
          <Pencil className="w-4 h-4 mr-2" />
          Rename
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleDeleteOption} 
          disabled={!activeOptionId || optionsList.length <= 1}
          variant="destructive"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
