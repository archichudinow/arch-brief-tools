import { useUIStore, type DetailLevel } from '@/stores';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Layers, LayoutGrid, ListTree } from 'lucide-react';

const LEVELS: Array<{
  value: DetailLevel;
  label: string;
  description: string;
  icon: typeof Layers;
  areaCount: string;
}> = [
  {
    value: 'abstract',
    label: 'Abstract',
    description: 'Major zones only (4-6 areas)',
    icon: Layers,
    areaCount: '4-6',
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Functional breakdown (15-25 areas)',
    icon: LayoutGrid,
    areaCount: '15-25',
  },
  {
    value: 'detailed',
    label: 'Detailed',
    description: 'Complete breakdown (50+ areas)',
    icon: ListTree,
    areaCount: '50+',
  },
];

export function DetailLevelSelector() {
  const detailLevel = useUIStore((s) => s.detailLevel);
  const setDetailLevel = useUIStore((s) => s.setDetailLevel);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Detail:</span>
        {LEVELS.map((level) => {
          const Icon = level.icon;
          const isActive = detailLevel === level.value;
          
          return (
            <Tooltip key={level.value}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`h-6 px-2 text-xs ${isActive ? 'bg-secondary' : ''}`}
                  onClick={() => setDetailLevel(level.value)}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {level.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="font-medium">{level.label}</p>
                <p className="text-xs text-muted-foreground">{level.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
