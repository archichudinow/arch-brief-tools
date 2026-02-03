// Project Metadata
export interface ProjectMetadata {
  projectId: string;
  projectName: string;
  createdAt: string;
  modifiedAt: string;
  appVersion: string;
}

// Step IDs
export type StepId = 
  | 'input' 
  | 'normalize' 
  | 'grouping' 
  | 'rules' 
  | 'constraints' 
  | 'variants' 
  | 'outputs';

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'input', label: 'Input' },
  { id: 'normalize', label: 'Normalize' },
  { id: 'grouping', label: 'Grouping' },
  { id: 'rules', label: 'Rules' },
  { id: 'constraints', label: 'Constraints' },
  { id: 'variants', label: 'Variants' },
  { id: 'outputs', label: 'Outputs' },
];

// Input Types
export interface RawInput {
  textBrief: string;
  excelFile: File | null;
  excelData: string[][] | null;
}

export interface SiteParameters {
  siteArea?: number;
  maxHeight?: number;
  maxFootprintRatio?: number;
  buildingCountHint?: 'single' | 'multiple' | 'podium_towers';
}

// Program Data

/**
 * SIMPLIFIED: Instead of complex rule structures, AI leaves text notes.
 * This allows flexibility for any brief type without predicting all cases.
 */
export interface ProgramItem {
  id: string;
  name: string;
  area: number;               // Area per instance
  quantity: number;           // Number of instances
  totalArea: number;          // area × quantity
  unit: 'sqm' | 'sqft';
  areaType: 'net' | 'gross' | 'unknown';
  confidence: number;
  source: 'ai' | 'user' | 'excel';
  category?: string;          // Original category from brief (e.g., "Client facilities")
  
  // AI-generated text notes about placement, repetition, adjacencies, etc.
  // This replaces complex PlacementRules with flexible natural language.
  aiNotes: string;
  
  // User's own notes (editable in the normalize table)
  userNotes?: string;
  
  // Raw notes from brief (original text snippets)
  briefExcerpt?: string;
}

export interface Assumption {
  id: string;
  field: string;
  assumedValue: unknown;
  reasoning: string;
  accepted: boolean;
}

export interface NormalizedProgram {
  items: ProgramItem[];
  totalArea: number;
  assumptions: Assumption[];
  locked: boolean;
}

// Functional Groups
export type Classification = 'public' | 'semi-public' | 'private';

/**
 * SIMPLIFIED FunctionalGroup - uses text notes instead of complex rule structures.
 * AI explains grouping logic in natural language, user can refine via chat.
 */
export interface FunctionalGroup {
  id: string;
  name: string;
  color: string;
  programIds: string[];
  classification: Classification;
  
  // AI-generated explanation of why these programs are grouped,
  // placement logic, repetition rules, relationships with other groups.
  aiNotes: string;
  
  // User's refinement comment (from chat interaction)
  userComment?: string;
  
  // Preferred building zones for this group
  preferredPlacement: {
    ground: boolean;
    podium: boolean;
    tower: boolean;
    standalone: boolean;
  };
  
  // Can this cluster be split across levels/buildings?
  splittable: {
    acrossLevels: boolean;
    acrossBuildings: boolean;
  };
  
  // Was this derived from brief (true) or user-modified (false)?
  derivedFromBrief: boolean;
}

// Chat Messages for AI refinement
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
  // Optional: labels of attached items for display
  attachedItems?: string[];
  // Optional: attached program IDs for context
  attachedProgramIds?: string[];
  // Optional: attached group IDs for context
  attachedGroupIds?: string[];
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}

// Rules - SIMPLIFIED: AI generates these based on group aiNotes
export interface GroupRules {
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

// Constraints
export interface SiteConstraints {
  siteArea: number;
  buildableAreaRatio: number;
  maxBuildingCoverageArea: number;
}

export interface FootprintConstraints {
  minFootprintRatio: number;
  maxFootprintRatio: number;
  absoluteMaxFootprintArea: number;
  towerPlateRatioMax: number;
  podiumFootprintRatioMax: number;
}

export interface HeightConstraints {
  minTotalHeight: number;
  maxTotalHeight: number;
  towerHeightLimit: number;
  podiumHeightLimit: number;
}

export interface BuildingConstraints {
  minBuildingCount: number;
  maxBuildingCount: number;
  maxTowerCount: number;
  maxPodiumCount: number;
}

export interface LevelConstraints {
  minLevels: number;
  maxLevels: number;
  preferredLevels?: number;
  defaultFloorHeight: number;
}

export interface AllConstraints {
  site: SiteConstraints;
  footprint: FootprintConstraints;
  height: HeightConstraints;
  building: BuildingConstraints;
  level: LevelConstraints;
}

// Variants
export interface ProgramAllocation {
  programId: string;
  groupId: string;
  area: number;
}

export interface LevelAllocation {
  levelNumber: number;
  floorHeight: number;
  footprintArea: number;
  programs: ProgramAllocation[];
}

export interface BuildingMass {
  id: string;
  type: 'podium' | 'tower' | 'standalone';
  footprintArea: number;
  levels: LevelAllocation[];
  totalHeight: number;
  totalArea: number;
}

export interface VariantScore {
  efficiency: number;
  compactness: number;
  heightBalance: number;
  overall: number;
}

export interface Variant {
  id: string;
  buildings: BuildingMass[];
  totalArea: number;
  totalHeight: number;
  totalFootprint: number;
  score: VariantScore;
  valid: boolean;
  validationErrors: string[];
}

// App State
export interface ProgressState {
  lastCompletedStep: StepId | null;
  activeStep: StepId;
  lockedSteps: StepId[];
}

export interface InputState {
  raw: RawInput;
  site: SiteParameters;
}

export interface AppState {
  project: ProjectMetadata;
  progress: ProgressState;
  input: InputState;
  normalized: NormalizedProgram | null;
  groups: FunctionalGroup[];
  rules: GroupRules[];
  constraints: AllConstraints | null;
  variants: Variant[];
  selectedVariantId: string | null;
}
