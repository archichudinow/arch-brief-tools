import { useProjectStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { AreaNodeItem } from './AreaNodeItem';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateAreaDialog } from './CreateAreaDialog';

export function AreaTree() {
  const nodes = useProjectStore((s) => s.nodes);
  const getTotalArea = useProjectStore((s) => s.getTotalArea);

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const totalArea = getTotalArea();
  const nodeList = Object.values(nodes);
  const nodeCount = nodeList.length;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Areas</h2>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Tree Content */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {nodeList.map((node) => (
            <AreaNodeItem key={node.id} node={node} />
          ))}

          {/* Empty State */}
          {nodeCount === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No areas yet</p>
              <p className="text-xs mt-1">Click "Add" to create your first area</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Summary */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {nodeCount} area{nodeCount !== 1 ? 's' : ''}
          </span>
          <span className="font-medium">
            {totalArea.toLocaleString()} m²
          </span>
        </div>
      </div>

      {/* Create Dialog */}
      <CreateAreaDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
