import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/utils';
import { Box, Layers } from 'lucide-react';

// Color palette for functional groups
const GROUP_COLORS = [
  '#22c55e', // green - public
  '#3b82f6', // blue - private
  '#eab308', // yellow - semi-public
  '#a855f7', // purple - service
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
];

interface BarProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

function Bar({ position, size, color }: BarProps) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function SectionView() {
  const { state } = useApp();
  const { normalized } = state;

  if (!normalized || normalized.items.length === 0) {
    return null;
  }

  // Calculate total area and create stacked bars
  const items = normalized.items;
  const maxArea = Math.max(...items.map(i => i.area));
  const scale = 4 / maxArea; // Normalize to max width of 4 units

  let currentY = 0;
  const barHeight = 0.3;
  const gap = 0.05;

  return (
    <group position={[0, -items.length * (barHeight + gap) / 2, 0]}>
      {items.map((item, index) => {
        const width = Math.max(item.area * scale, 0.2);
        const y = currentY;
        currentY += barHeight + gap;
        
        return (
          <Bar
            key={item.id}
            position={[0, y, 0]}
            size={[width, barHeight, 0.5]}
            color={GROUP_COLORS[index % GROUP_COLORS.length]}
          />
        );
      })}
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <SectionView />
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={20}
      />
    </>
  );
}

interface PreviewPanelProps {
  className?: string;
}

export function PreviewPanel({ className }: PreviewPanelProps) {
  const { state } = useApp();
  const hasData = state.normalized && state.normalized.items.length > 0;

  return (
    <div className={cn(
      'flex flex-col bg-card border-l border-border',
      className
    )}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Section Preview
        </h3>
        {hasData && (
          <span className="text-xs text-muted-foreground">
            {state.normalized?.items.length} programs
          </span>
        )}
      </div>
      
      <div className="flex-1 relative">
        {hasData ? (
          <Canvas
            camera={{ position: [0, 0, 8], fov: 50 }}
            style={{ background: '#0a0a0a' }}
          >
            <Scene />
          </Canvas>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center text-muted-foreground">
              <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">3D Preview</p>
              <p className="text-xs mt-1">Will appear as data becomes available</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {hasData && state.normalized && (
        <div className="px-4 py-3 border-t border-border max-h-48 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">Legend</p>
          <div className="space-y-1">
            {state.normalized.items.slice(0, 8).map((item, index) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: GROUP_COLORS[index % GROUP_COLORS.length] }}
                />
                <span className="truncate">{item.name}</span>
                <span className="text-muted-foreground ml-auto">{item.area.toLocaleString()}</span>
              </div>
            ))}
            {state.normalized.items.length > 8 && (
              <p className="text-muted-foreground">+{state.normalized.items.length - 8} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
