import { useProjectStore } from '@/stores';
import { cn } from '@/lib/utils';
import { STEP_NAMES, type StepId } from '@/types';
import { Check } from 'lucide-react';

export function StepBar() {
  const currentStep = useProjectStore((s) => s.meta.currentStep);
  const setCurrentStep = useProjectStore((s) => s.setCurrentStep);
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);

  const steps: StepId[] = [0, 1, 2, 3];

  const getStepStatus = (step: StepId): 'complete' | 'active' | 'incomplete' => {
    if (step < currentStep) return 'complete';
    if (step === currentStep) return 'active';
    return 'incomplete';
  };

  const isStepAccessible = (step: StepId): boolean => {
    // Step 0 and 1 always accessible
    if (step <= 1) return true;
    // Step 2 requires at least one area node
    if (step === 2) return Object.keys(nodes).length > 0;
    // Step 3 requires groups
    if (step === 3) return Object.keys(groups).length > 0;
    return false;
  };

  return (
    <div className="h-12 border-b border-border bg-muted/30 flex items-center justify-center px-4">
      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const status = getStepStatus(step);
          const accessible = isStepAccessible(step);

          return (
            <div key={step} className="flex items-center">
              {index > 0 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-1',
                    status === 'complete' || (index < currentStep)
                      ? 'bg-primary'
                      : 'bg-border'
                  )}
                />
              )}
              <button
                onClick={() => accessible && setCurrentStep(step)}
                disabled={!accessible}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  status === 'active' && 'bg-primary text-primary-foreground',
                  status === 'complete' && 'bg-primary/10 text-primary hover:bg-primary/20',
                  status === 'incomplete' && accessible && 'bg-muted text-muted-foreground hover:bg-muted/80',
                  status === 'incomplete' && !accessible && 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                )}
              >
                {status === 'complete' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="w-4 h-4 flex items-center justify-center text-xs">
                    {step}
                  </span>
                )}
                <span>{STEP_NAMES[step]}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
