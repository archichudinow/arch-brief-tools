import { Construction } from 'lucide-react';

interface PlaceholderStepProps {
  title: string;
  description: string;
}

export function PlaceholderStep({ title, description }: PlaceholderStepProps) {
  return (
    <div className="max-w-4xl">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Construction className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          {description}
        </p>
        <p className="text-sm text-muted-foreground/70 mt-4">
          Complete the previous steps first.
        </p>
      </div>
    </div>
  );
}
