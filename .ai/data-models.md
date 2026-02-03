# Data Models & TypeScript Interfaces

## Project Metadata

```typescript
interface ProjectMetadata {
  projectId: string;
  projectName: string;
  createdAt: Date;
  modifiedAt: Date;
  appVersion: string;
}
```

## Input Types

```typescript
interface RawInput {
  textBrief: string;
  excelFile?: File | null;
  excelData?: any[][];  // Parsed Excel rows
}

interface SiteParameters {
  siteArea?: number;
  maxHeight?: number;
  maxFootprintRatio?: number;
  buildingCountHint?: 'single' | 'multiple' | 'podium_towers';
}
```

## Program Data (Enhanced with Placement Rules)

```typescript
// Repetition rules extracted from brief
type RepetitionRule = 
  | { type: 'once' }                                    // Single instance
  | { type: 'per_floor' }                               // One on every floor
  | { type: 'per_group'; groupName: string }            // One per functional group
  | { type: 'per_n_groups'; n: number; groupName: string } // One per N groups
  | { type: 'quantity'; count: number }                 // Fixed quantity
  | { type: 'central_per_floor' }                       // Central location, per floor
  | { type: 'distributed' };                            // Spread throughout

// Adjacency rules
interface AdjacencyRule {
  type: 'must_be_adjacent' | 'should_be_adjacent' | 'must_not_be_adjacent';
  targetName: string;
  targetId?: string;
  confidence: number;
}

// Vertical placement constraints
interface VerticalPlacementRule {
  groundFloor?: 'required' | 'preferred' | 'forbidden';
  upperFloors?: 'required' | 'preferred' | 'forbidden';
  basement?: 'required' | 'preferred' | 'forbidden';
  specificFloor?: number;
}

interface PlacementRules {
  repetition: RepetitionRule;
  adjacencies: AdjacencyRule[];
  vertical: VerticalPlacementRule;
  notes: string[];
}

interface ProgramItem {
  id: string;
  name: string;
  area: number;               // Area per instance
  quantity: number;           // Number of instances
  totalArea: number;          // area × quantity
  unit: 'sqm' | 'sqft';
  areaType: 'net' | 'gross' | 'unknown';
  confidence: number;
  source: 'ai' | 'user' | 'excel';
  category?: string;          // From brief (e.g., "Client facilities")
  notes?: string;
  placementRules: PlacementRules;  // Extracted from brief!
}

interface NormalizedProgram {
  items: ProgramItem[];
  totalArea: number;
  assumptions: Assumption[];
  locked: boolean;
}

interface Assumption {
  id: string;
  field: string;
  assumedValue: any;
  reasoning: string;
  accepted: boolean;
}
```

## Smart Clusters (Enhanced Grouping)

```typescript
// Cluster types for different behavior patterns
type ClusterType = 
  | 'functional'       // Traditional grouping (can be anywhere together)
  | 'per_floor'        // Must repeat on each floor
  | 'anchor'           // Fixed position (e.g., reception)
  | 'satellite'        // Must stay near anchor/parent
  | 'distributed'      // Can be split freely
  | 'unit_based';      // Repeating unit (e.g., residential group)

// Relationships between clusters
interface ClusterBinding {
  type: 'must_be_with' | 'prefer_with' | 'must_not_be_with' | 'same_floor' | 'adjacent_floor';
  targetClusterId: string;
  inherited: boolean;      // From brief vs user-added
  confidence: number;
}

interface FunctionalGroup {
  id: string;
  name: string;
  color: string;
  programIds: string[];
  classification: 'public' | 'semi-public' | 'private';
  
  // NEW: Cluster behavior
  clusterType: ClusterType;
  
  // NEW: Instance control
  instanceRule: 
    | { type: 'single' }
    | { type: 'per_floor' }
    | { type: 'per_parent'; parentClusterId: string }
    | { type: 'fixed_count'; count: number };
  
  preferredPlacement: PlacementPreference;
  bindings: ClusterBinding[];  // NEW
  splittable: SplittableConfig;
  derivedFromBrief: boolean;   // NEW
  aiReasoning?: string;
}

interface PlacementPreference {
  ground: boolean;
  podium: boolean;
  tower: boolean;
  standalone: boolean;
}

interface SplittableConfig {
  acrossLevels: boolean;
  acrossBuildings: boolean;
  maxContiguousLevels?: number;
}
```

## Rules

```typescript
interface GroupRules {
  groupId: string;
  
  // Building distribution
  singleBuildingOnly: boolean;
  multipleBuildingsAllowed: boolean;
  standaloneBuildingPreferred: boolean;
  
  // Podium & tower
  podiumAllowed: boolean;
  podiumOnly: boolean;
  towerAllowed: boolean;
  towerOnly: boolean;
  
  // Vertical placement
  mustBeGroundFloor: boolean;
  groundFloorPreferred: boolean;
  upperFloorsOnly: boolean;
  basementAllowed: boolean;
  
  // Splitting
  splittableAcrossLevels: boolean;
  splittableAcrossBuildings: boolean;
  mustBeContiguous: boolean;
  maxContiguousLevels?: number;
  
  // Area distribution
  minAreaPerLevel?: number;
  maxAreaPerLevel?: number;
  
  // Height
  minFloorHeight: number;
  maxFloorHeight: number;
  doubleHeightAllowed: boolean;
}
```

## Constraints

```typescript
interface SiteConstraints {
  siteArea: number;
  buildableAreaRatio: number;
  maxBuildingCoverageArea: number;
}

interface FootprintConstraints {
  minFootprintRatio: number;
  maxFootprintRatio: number;
  absoluteMaxFootprintArea: number;
  towerPlateRatioMax: number;
  podiumFootprintRatioMax: number;
}

interface HeightConstraints {
  minTotalHeight: number;
  maxTotalHeight: number;
  towerHeightLimit: number;
  podiumHeightLimit: number;
}

interface BuildingConstraints {
  minBuildingCount: number;
  maxBuildingCount: number;
  maxTowerCount: number;
  maxPodiumCount: number;
}

interface LevelConstraints {
  minLevels: number;
  maxLevels: number;
  preferredLevels?: number;
  defaultFloorHeight: number;
}

interface AllConstraints {
  site: SiteConstraints;
  footprint: FootprintConstraints;
  height: HeightConstraints;
  building: BuildingConstraints;
  level: LevelConstraints;
}
```

## Variants

```typescript
interface BuildingMass {
  id: string;
  type: 'podium' | 'tower' | 'standalone';
  footprintArea: number;
  levels: LevelAllocation[];
  totalHeight: number;
  totalArea: number;
}

interface LevelAllocation {
  levelNumber: number;
  floorHeight: number;
  footprintArea: number;
  programs: ProgramAllocation[];
}

interface ProgramAllocation {
  programId: string;
  groupId: string;
  area: number;
}

interface Variant {
  id: string;
  buildings: BuildingMass[];
  totalArea: number;
  totalHeight: number;
  totalFootprint: number;
  score: VariantScore;
  valid: boolean;
  validationErrors: string[];
}

interface VariantScore {
  efficiency: number;
  compactness: number;
  heightBalance: number;
  overall: number;
}
```

## Export Types

```typescript
interface ProjectExport {
  metadata: ProjectMetadata;
  progress: ProgressState;
  input: RawInput;
  normalized: NormalizedProgram;
  groups: FunctionalGroup[];
  rules: GroupRules[];
  constraints: AllConstraints;
  variants: Variant[];
  selectedVariantId?: string;
}

interface ProgressState {
  lastCompletedStep: StepId;
  activeStep: StepId;
  lockedSteps: StepId[];
}

type StepId = 'input' | 'normalize' | 'grouping' | 'rules' | 'constraints' | 'variants' | 'outputs';
```
