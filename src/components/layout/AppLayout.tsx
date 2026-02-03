import type { ReactNode } from 'react';
import { StepTimeline } from './StepTimeline';
import { PreviewPanel } from '@/components/preview';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      {/* Top Navigation */}
      <StepTimeline />
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
        
        {/* Preview Panel */}
        <PreviewPanel className="w-96 hidden lg:flex" />
      </div>
    </div>
  );
}
