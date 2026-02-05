import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Building2, MapPin, Map, Globe } from 'lucide-react';
import type { ScaleClarificationOption } from '@/types';

interface ClarificationCardProps {
  message: string;
  options: ScaleClarificationOption[];
  onSelect: (option: ScaleClarificationOption) => void;
  onDismiss: () => void;
}

const SCALE_ICONS = {
  interior: Building2,
  architecture: Building2,
  landscape: MapPin,
  masterplan: Map,
  urban: Globe,
};

const SCALE_COLORS = {
  interior: 'bg-blue-100 text-blue-800',
  architecture: 'bg-green-100 text-green-800',
  landscape: 'bg-emerald-100 text-emerald-800',
  masterplan: 'bg-amber-100 text-amber-800',
  urban: 'bg-purple-100 text-purple-800',
};

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(1)}M m²`;
  if (sqm >= 1_000) return `${(sqm / 1_000).toFixed(0)}K m²`;
  return `${sqm.toLocaleString()} m²`;
}

export function ClarificationCard({ 
  message, 
  options, 
  onSelect, 
  onDismiss 
}: ClarificationCardProps) {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Clarification Needed</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{message}</p>
        
        <div className="space-y-2">
          {options.map((option, index) => {
            const Icon = SCALE_ICONS[option.scale] || Building2;
            const colorClass = SCALE_COLORS[option.scale] || 'bg-gray-100 text-gray-800';
            
            return (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start h-auto py-3 px-4"
                onClick={() => onSelect(option)}
              >
                <div className="flex items-start gap-3 w-full">
                  <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{option.label}</span>
                      <Badge className={`text-[10px] ${colorClass}`}>
                        {option.scale}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatArea(option.area)}
                      {option.interpretation && (
                        <span className="ml-1">— {option.interpretation}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-muted-foreground"
          onClick={onDismiss}
        >
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
}
