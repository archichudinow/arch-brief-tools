import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Layers, GitBranch, Network } from 'lucide-react';

export type ExploreDepth = 1 | 2 | 3;

interface ExpandDepthSelectorProps {
  depth: ExploreDepth;
  onDepthChange: (depth: ExploreDepth) => void;
}

const DEPTHS: Array<{
  value: ExploreDepth;
  label: string;
  description: string;
  icon: typeof Layers;
}> = [
  {
    value: 1,
    label: '1 Level',
    description: 'Break into immediate sub-areas',
    icon: Layers,
  },
  {
    value: 2,
    label: '2 Levels',
    description: 'Break with one level of detail',
    icon: GitBranch,
  },
  {
    value: 3,
    label: '3 Levels',
    description: 'Full hierarchical breakdown',
    icon: Network,
  },
];

export function ExpandDepthSelector({ depth, onDepthChange }: ExpandDepthSelectorProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Expand:</span>
        {DEPTHS.map((level) => {
          const Icon = level.icon;
          const isActive = depth === level.value;
          
          return (
            <Tooltip key={level.value}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`h-6 px-2 text-xs ${isActive ? 'bg-secondary' : ''}`}
                  onClick={() => onDepthChange(level.value)}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {level.value}
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
