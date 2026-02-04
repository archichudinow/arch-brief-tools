import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Bot,
  User,
  Trash2,
  Edit2,
  Check,
  X,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import type { Note, NoteSource } from '@/types';

interface NotesCardProps {
  notes: Note[];
  onAddNote?: (source: NoteSource, content: string) => void;
  onUpdateNote?: (noteId: string, content: string) => void;
  onDeleteNote?: (noteId: string) => void;
  readOnly?: boolean;
}

const SOURCE_CONFIG: Record<NoteSource, { icon: typeof FileText; label: string; color: string }> = {
  brief: { icon: FileText, label: 'Brief', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  ai: { icon: Bot, label: 'AI', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  user: { icon: User, label: 'User', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
};

export function NotesCard({ notes, onAddNote, onUpdateNote, onDeleteNote, readOnly = false }: NotesCardProps) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteSource, setNewNoteSource] = useState<NoteSource>('user');

  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (editingNoteId && editContent.trim() && onUpdateNote) {
      onUpdateNote(editingNoteId, editContent.trim());
    }
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleAddNote = () => {
    if (newNoteContent.trim() && onAddNote) {
      onAddNote(newNoteSource, newNoteContent.trim());
      setNewNoteContent('');
      setShowAddNote(false);
    }
  };

  // Group notes by source
  const briefNotes = notes.filter(n => n.source === 'brief');
  const aiNotes = notes.filter(n => n.source === 'ai');
  const userNotes = notes.filter(n => n.source === 'user');

  const renderNote = (note: Note) => {
    const config = SOURCE_CONFIG[note.source];
    const Icon = config.icon;
    const isEditing = editingNoteId === note.id;

    return (
      <Card key={note.id} className={`p-3 ${config.color} border`}>
        <div className="flex items-start gap-2">
          <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {config.label}
              </Badge>
              {!readOnly && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleStartEdit(note)}>
                      <Edit2 className="h-3 w-3 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDeleteNote?.(note.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="text-xs min-h-[60px]"
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-xs" onClick={handleSaveEdit}>
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleCancelEdit}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{note.content}</p>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderNoteGroup = (groupNotes: Note[], source: NoteSource) => {
    if (groupNotes.length === 0) return null;
    const config = SOURCE_CONFIG[source];
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <config.icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{config.label} Notes</span>
          <span className="text-xs text-muted-foreground">({groupNotes.length})</span>
        </div>
        {groupNotes.map(renderNote)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Brief notes */}
      {renderNoteGroup(briefNotes, 'brief')}
      
      {/* AI notes */}
      {renderNoteGroup(aiNotes, 'ai')}
      
      {/* User notes */}
      {renderNoteGroup(userNotes, 'user')}
      
      {/* Empty state */}
      {notes.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-xs">
          No notes yet
        </div>
      )}
      
      {/* Add note section */}
      {!readOnly && (
        <div className="pt-2 border-t border-border">
          {showAddNote ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                {(['user', 'ai', 'brief'] as NoteSource[]).map((source) => {
                  const config = SOURCE_CONFIG[source];
                  const Icon = config.icon;
                  return (
                    <Button
                      key={source}
                      variant={newNoteSource === source ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setNewNoteSource(source)}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
              <Textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Add a note about this area..."
                className="text-xs min-h-[80px]"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs" onClick={handleAddNote}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Note
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-xs" 
                  onClick={() => {
                    setShowAddNote(false);
                    setNewNoteContent('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setShowAddNote(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Note
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
