import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface BoardCommentProps {
  id: string;
  x: number;
  y: number;
  text: string;
  isEditing?: boolean;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
  scale: number;
}

export function BoardComment({
  id,
  x,
  y,
  text,
  isEditing: initialEditing = false,
  onUpdate,
  onDelete,
  onDrag,
  scale,
}: BoardCommentProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [isDragging, setIsDragging] = useState(false);
  const [localText, setLocalText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { 
      x: e.clientX, 
      y: e.clientY,
      startX: x,
      startY: y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - dragStartRef.current.x) / scale;
      const deltaY = (moveEvent.clientY - dragStartRef.current.y) / scale;
      onDrag(id, dragStartRef.current.startX + deltaX, dragStartRef.current.startY + deltaY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (localText.trim()) {
      onUpdate(id, localText);
    } else {
      onDelete(id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalText(text);
      setIsEditing(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  };

  return (
    <div
      className={`
        absolute group
        ${isDragging ? 'cursor-grabbing z-50' : 'cursor-grab'}
      `}
      style={{
        left: x,
        top: y,
        transform: 'translate(-8px, -8px)', // Offset for the pin point
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Delete button */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Comment body */}
      <div
        className="bg-yellow-100 dark:bg-yellow-900/80 rounded-sm shadow-md px-3 py-2 min-w-[80px] max-w-[200px]"
        style={{
          // Handwritten style with slight rotation for natural feel
          transform: `rotate(${(id.charCodeAt(0) % 5) - 2}deg)`,
          boxShadow: '2px 2px 4px rgba(0,0,0,0.15)',
        }}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[40px] bg-transparent border-none outline-none resize-none text-yellow-900 dark:text-yellow-100"
            style={{
              fontFamily: "'Caveat', 'Segoe Script', 'Bradley Hand', cursive",
              fontSize: '16px',
              lineHeight: '1.3',
            }}
            placeholder="Add note..."
          />
        ) : (
          <div
            className="text-yellow-900 dark:text-yellow-100 whitespace-pre-wrap break-words"
            style={{
              fontFamily: "'Caveat', 'Segoe Script', 'Bradley Hand', cursive",
              fontSize: '16px',
              lineHeight: '1.3',
            }}
          >
            {text || 'Double-click to edit'}
          </div>
        )}
      </div>
    </div>
  );
}
