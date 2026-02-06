import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Layers, LayoutGrid, Network } from 'lucide-react';
import type { ExpandDetailLevel } from '@/services';

interface DetailLevelSelectorProps {
  level: ExpandDetailLevel;
  onLevelChange: (level: ExpandDetailLevel) => void;
}

const DETAIL_LEVELS: Array<{
  value: ExpandDetailLevel;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Layers;
}> = [
  {
    value: 'abstract',
    label: 'Abstract',
    shortLabel: 'Abs',
    description: '4-6 major functional zones',
    icon: Layers,
  },
  {
    value: 'typical',
    label: 'Typical',
    shortLabel: 'Typ',
    description: '6-10 functional area types',
    icon: LayoutGrid,
  },
  {
    value: 'detailed',
    label: 'Detailed',
    shortLabel: 'Det',
    description: '12-20 specific spaces with counts',
    icon: Network,
  },
];

export function DetailLevelSelector({ level, onLevelChange }: DetailLevelSelectorProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Detail:</span>
        {DETAIL_LEVELS.map((item) => {
          const Icon = item.icon;
          const isActive = level === item.value;
          
          return (
            <Tooltip key={item.value}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  className={`h-7 px-2.5 text-xs font-medium transition-all ${
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => onLevelChange(item.value)}
                >
                  <Icon className={`w-3.5 h-3.5 mr-1 ${isActive ? '' : 'opacity-70'}`} />
                  {item.shortLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// Legacy export for backward compatibility
export type ExploreDepth = 1 | 2 | 3;
export const ExpandDepthSelector = DetailLevelSelector;
