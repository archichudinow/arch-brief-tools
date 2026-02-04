import { z } from 'zod';

// ============================================
// PROPOSAL SCHEMAS
// ============================================

const CreateAreasProposalSchema = z.object({
  type: z.literal('create_areas'),
  areas: z.array(z.object({
    name: z.string(),
    areaPerUnit: z.number().positive(),
    count: z.number().int().positive(),
    briefNote: z.string().optional(),
    aiNote: z.string().optional(),
  })),
});

const SplitAreaProposalSchema = z.object({
  type: z.literal('split_area'),
  sourceNodeId: z.string().uuid(),
  sourceName: z.string(),
  splits: z.array(z.object({
    name: z.string(),
    areaPerUnit: z.number().positive(),
    count: z.number().int().positive(),
  })).min(2),
  groupName: z.string().optional(),
  groupColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const MergeAreasProposalSchema = z.object({
  type: z.literal('merge_areas'),
  sourceNodeIds: z.array(z.string().uuid()).min(2),
  sourceNames: z.array(z.string()).min(2),
  result: z.object({
    name: z.string(),
    areaPerUnit: z.number().positive(),
    count: z.number().int().positive(),
  }),
});

const UpdateAreasProposalSchema = z.object({
  type: z.literal('update_areas'),
  updates: z.array(z.object({
    nodeId: z.string().uuid(),
    nodeName: z.string(),
    changes: z.object({
      name: z.string().optional(),
      areaPerUnit: z.number().positive().optional(),
      count: z.number().int().positive().optional(),
    }),
  })),
});

const CreateGroupsProposalSchema = z.object({
  type: z.literal('create_groups'),
  groups: z.array(z.object({
    name: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    memberNodeIds: z.array(z.string().uuid()),
    memberNames: z.array(z.string()),
  })),
});

const AssignToGroupProposalSchema = z.object({
  type: z.literal('assign_to_group'),
  groupId: z.string().uuid(),
  groupName: z.string(),
  nodeIds: z.array(z.string().uuid()),
  nodeNames: z.array(z.string()),
});

const AddNotesProposalSchema = z.object({
  type: z.literal('add_notes'),
  notes: z.array(z.object({
    targetType: z.enum(['area', 'group']),
    targetId: z.string().uuid(),
    targetName: z.string(),
    content: z.string(),
    reason: z.string().optional(),
  })),
});

const ProposalSchema = z.discriminatedUnion('type', [
  CreateAreasProposalSchema,
  SplitAreaProposalSchema,
  MergeAreasProposalSchema,
  UpdateAreasProposalSchema,
  CreateGroupsProposalSchema,
  AssignToGroupProposalSchema,
  AddNotesProposalSchema,
]);

// ============================================
// AI RESPONSE SCHEMAS
// ============================================

// Agent mode response: actions only, no reasoning
const AgentResponseSchema = z.object({
  message: z.string().max(300), // Keep responses short
  proposals: z.array(ProposalSchema).optional(),
});

// Consultation mode response: can include reasoning
const ConsultationResponseSchema = z.object({
  message: z.string(),
  reasoning: z.string().optional(),
  references: z.array(z.string()).optional(),
});

// ============================================
// TWO-PASS BRIEF PARSING SCHEMAS
// ============================================

// Pass 1: Raw extraction
const ExtractedRowSchema = z.object({
  text: z.string(),
  value: z.number().nonnegative(),
  multiplier: z.number().int().positive().default(1),
  section: z.string().nullable().optional(),
  parentSection: z.string().nullable().optional(),
  lineType: z.enum(['item', 'subtotal', 'total', 'header']),
  isOutdoor: z.boolean().default(false),
});

const BriefExtractionResultSchema = z.object({
  rows: z.array(ExtractedRowSchema),
  indoorTotal: z.number().nonnegative().nullable().optional(),
  outdoorTotal: z.number().nonnegative().nullable().optional(),
  projectDescription: z.string().optional(),
});

// Pass 2: Classification
const ClassifiedRowSchema = z.object({
  index: z.number().int().nonnegative(),
  classification: z.enum(['space', 'subtotal', 'total', 'skip']),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

const ClassifiedGroupSchema = z.object({
  name: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  parentGroup: z.string().nullable().optional(),
  itemIndices: z.array(z.number().int().nonnegative()),
  subtotalIndex: z.number().int().nonnegative().nullable().optional(),
});

const BriefClassificationResultSchema = z.object({
  classified: z.array(ClassifiedRowSchema),
  groups: z.array(ClassifiedGroupSchema).optional(),
  indoorTotal: z.number().nonnegative().nullable().optional(),
  outdoorTotal: z.number().nonnegative().nullable().optional(),
  projectContext: z.string().optional(),
});

// ============================================
// LEGACY SINGLE-PASS SCHEMAS
// ============================================

// Brief parsing response
const DetectedGroupSchema = z.object({
  name: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  areaNames: z.array(z.string()),
});

const GroupTotalSchema = z.object({
  groupName: z.string(),
  statedTotal: z.number().nonnegative(),
  parsedTotal: z.number().nonnegative(),
});

const ParsedBriefSchema = z.object({
  areas: z.array(z.object({
    name: z.string(),
    areaPerUnit: z.number().positive(),
    count: z.number().int().positive(),
    briefNote: z.string().optional(),
    groupHint: z.string().optional(),
  })),
  detectedGroups: z.array(DetectedGroupSchema).optional(),
  hasGroupStructure: z.boolean().optional(),
  briefTotal: z.number().nonnegative().nullable().optional(),
  parsedTotal: z.number().nonnegative().optional(),
  groupTotals: z.array(GroupTotalSchema).optional(),
  projectContext: z.string(),
  suggestedAreas: z.array(z.object({
    name: z.string(),
    areaPerUnit: z.number().nonnegative(), // Allow 0 for suggestions without sizes
    count: z.number().int().positive(),
    aiNote: z.string(),
  })).optional(),
  ambiguities: z.array(z.string()).optional(),
});

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawResponse?: string;
}

export function validateAgentResponse(response: unknown): ValidationResult<z.infer<typeof AgentResponseSchema>> {
  const result = AgentResponseSchema.safeParse(response);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: formatZodError(result.error),
  };
}

export function validateConsultationResponse(response: unknown): ValidationResult<z.infer<typeof ConsultationResponseSchema>> {
  const result = ConsultationResponseSchema.safeParse(response);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: formatZodError(result.error),
  };
}

export function validateParsedBrief(response: unknown): ValidationResult<z.infer<typeof ParsedBriefSchema>> {
  const result = ParsedBriefSchema.safeParse(response);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: formatZodError(result.error),
  };
}

export function validateProposal(proposal: unknown): ValidationResult<z.infer<typeof ProposalSchema>> {
  const result = ProposalSchema.safeParse(proposal);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: formatZodError(result.error),
  };
}

// Enhanced prompt options schema
const EnhancedPromptOptionSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  operations: z.array(z.string()),
  affectedItems: z.array(z.string()),
});

const EnhancedPromptsResponseSchema = z.object({
  options: z.array(EnhancedPromptOptionSchema).min(1).max(4),
});

export function validateEnhancedPrompts(response: unknown): ValidationResult<z.infer<typeof EnhancedPromptsResponseSchema>> {
  const result = EnhancedPromptsResponseSchema.safeParse(response);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: formatZodError(result.error),
  };
}

// Two-pass brief validation
export function validateBriefExtraction(response: unknown): ValidationResult<z.infer<typeof BriefExtractionResultSchema>> {
  const result = BriefExtractionResultSchema.safeParse(response);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: formatZodError(result.error),
  };
}

export function validateBriefClassification(response: unknown): ValidationResult<z.infer<typeof BriefClassificationResultSchema>> {
  const result = BriefClassificationResultSchema.safeParse(response);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: formatZodError(result.error),
  };
}

function formatZodError(error: z.ZodError<unknown>): string {
  return error.issues
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
}

// ============================================
// TYPE EXPORTS
// ============================================

export type ValidatedAgentResponse = z.infer<typeof AgentResponseSchema>;
export type ValidatedConsultationResponse = z.infer<typeof ConsultationResponseSchema>;
export type ValidatedParsedBrief = z.infer<typeof ParsedBriefSchema>;
export type ValidatedProposal = z.infer<typeof ProposalSchema>;
export type AddNotesProposal = z.infer<typeof AddNotesProposalSchema>;
export type EnhancedPromptOption = z.infer<typeof EnhancedPromptOptionSchema>;
export type EnhancedPromptsResponse = z.infer<typeof EnhancedPromptsResponseSchema>;
export type BriefExtractionResult = z.infer<typeof BriefExtractionResultSchema>;
export type BriefClassificationResult = z.infer<typeof BriefClassificationResultSchema>;
export type ExtractedRow = z.infer<typeof ExtractedRowSchema>;
export type ClassifiedRow = z.infer<typeof ClassifiedRowSchema>;
