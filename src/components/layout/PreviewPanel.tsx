import { cn } from '@/lib/utils';
import { Box } from 'lucide-react';

interface PreviewPanelProps {
  className?: string;
}

export function PreviewPanel({ className }: PreviewPanelProps) {
  return (
    <div className={cn(
      'flex flex-col bg-card border-l border-border',
      className
    )}>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-muted-foreground">Preview</h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">3D Preview</p>
          <p className="text-xs mt-1">Will appear as data becomes available</p>
        </div>
      </div>
    </div>
  );
}
