import { cn } from '@/lib/utils';
import { useApp } from '@/store/AppContext';
import { STEPS, type StepId } from '@/types';
import { Check } from 'lucide-react';

export function StepTimeline() {
  const { state, dispatch } = useApp();
  const { activeStep, lastCompletedStep } = state.progress;

  const getStepIndex = (stepId: StepId | null) => {
    if (!stepId) return -1;
    return STEPS.findIndex(s => s.id === stepId);
  };

  const completedIndex = getStepIndex(lastCompletedStep);

  return (
    <nav className="flex items-center gap-1 px-4 py-3 bg-card border-b border-border overflow-x-auto">
      {STEPS.map((step, index) => {
        const isActive = step.id === activeStep;
        const isCompleted = index <= completedIndex;
        const isClickable = index <= completedIndex + 1;

        return (
          <button
            key={step.id}
            onClick={() => isClickable && dispatch({ type: 'SET_STEP', payload: step.id })}
            disabled={!isClickable}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              isActive && 'bg-primary text-primary-foreground',
              !isActive && isCompleted && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              !isActive && !isCompleted && isClickable && 'bg-muted text-muted-foreground hover:bg-muted/80',
              !isActive && !isCompleted && !isClickable && 'bg-muted/50 text-muted-foreground'
            )}
          >
            {isCompleted && !isActive && (
              <Check className="w-4 h-4" />
            )}
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-xs',
              isActive ? 'bg-primary-foreground/20' : 'bg-current/10'
            )}>
              {index + 1}
            </span>
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}
