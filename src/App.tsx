import { AppProvider, useApp } from '@/store/AppContext';
import { AppLayout } from '@/components/layout';
import { InputStep, NormalizeStep, GroupingStep, PlaceholderStep } from '@/components/steps';

function StepContent() {
  const { state } = useApp();
  const { activeStep } = state.progress;

  switch (activeStep) {
    case 'input':
      return <InputStep />;
    case 'normalize':
      return <NormalizeStep />;
    case 'grouping':
      return <GroupingStep />;
    case 'rules':
      return (
        <PlaceholderStep
          title="Rule Assignment"
          description="Define rules for each functional group: floor placement, splitting, height constraints."
        />
      );
    case 'constraints':
      return (
        <PlaceholderStep
          title="Parametric Constraints"
          description="Set numeric constraints for site, footprint, height, and building count."
        />
      );
    case 'variants':
      return (
        <PlaceholderStep
          title="Variant Generation"
          description="Generate and explore multiple valid massing variants based on your rules and constraints."
        />
      );
    case 'outputs':
      return (
        <PlaceholderStep
          title="Export Outputs"
          description="Export Excel tables, GLB geometry, and project files."
        />
      );
    default:
      return null;
  }
}

function App() {
  return (
    <AppProvider>
      <AppLayout>
        <StepContent />
      </AppLayout>
    </AppProvider>
  );
}

export default App;
