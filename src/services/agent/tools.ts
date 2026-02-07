/**
 * Agent Tools - OpenAI function definitions for area tools
 * 
 * These tools map to our existing actions but are described
 * in a way that the LLM can understand and decide when to use.
 */

import type { ToolDefinition } from './types';

// ============================================
// TOOL DEFINITIONS
// ============================================

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_program',
      description: `Create and ADD a new architectural program to the project. This ADDS new areas - it does NOT modify or replace existing areas. Use this for requests like "create a hotel", "add office building", "make a school program", "design a spa". The new areas will be added alongside any existing areas in the project.`,
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description of what to create (e.g., "200-room boutique hotel", "50,000 sqm office tower", "elementary school for 500 students")',
          },
          detailLevel: {
            type: 'string',
            description: 'Level of detail: "abstract" for 4-6 major zones, "typical" for 6-10 areas with counts, "detailed" for 12-20 specific spaces',
            enum: ['abstract', 'typical', 'detailed'],
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unfold_area',
      description: `Expand area(s) into more detailed sub-areas. Works with: (1) a specific area by ID/name, (2) selected areas, or (3) all areas within selected groups. For example, if groups "Client facilities" and "General facilities" are selected, this will unfold all areas within those groups. The depth of unfolding is automatic based on each area's scale.`,
      parameters: {
        type: 'object',
        properties: {
          areaId: {
            type: 'string',
            description: 'ID of a specific area to unfold. If not specified, unfolds selected area(s) or all areas in selected groups.',
          },
          areaName: {
            type: 'string',
            description: 'Name of area to unfold (searches by name if areaId not provided)',
          },
          focus: {
            type: 'string',
            description: 'Optional focus for unfolding (e.g., "focus on guest amenities", "emphasize accessibility")',
          },
          detailLevel: {
            type: 'string',
            description: 'Level of detail: "abstract" for 3-5 zones, "typical" for 5-8 areas, "detailed" for 8-12 specific spaces',
            enum: ['abstract', 'typical', 'detailed'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'organize_areas',
      description: `Organize areas into logical groups. Use this to create category groupings like "Public Zones", "Back of House", "Guest Areas" etc. Works on selected areas or all areas if none selected.`,
      parameters: {
        type: 'object',
        properties: {
          strategy: {
            type: 'string',
            description: 'Grouping strategy',
            enum: ['functional', 'spatial', 'circulation', 'custom'],
          },
          customGrouping: {
            type: 'string',
            description: 'Description of custom grouping logic (only if strategy is "custom")',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'split_group',
      description: `Split a group into N equal sub-groups numerically. Use when user wants to divide a group into equal NUMBERED parts (e.g., "split into 8 groups", "divide into 4 modules", "create 3 copies"). This splits by COUNT or AREA equally - NOT by function/type. For functional reorganization (e.g., "split by function", "create subgroups by type"), use regroup_by_function instead. Works in two modes: (1) If total units >= N, distributes unit counts equally. (2) If total units < N, divides the m² equally.`,
      parameters: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: 'ID of the group to split. If not provided, uses selected group.',
          },
          groupName: {
            type: 'string',
            description: 'Name of the group to split. Used if groupId not provided.',
          },
          numberOfGroups: {
            type: 'number',
            description: 'Number of sub-groups to create (e.g., 8 for "split into 8 groups")',
          },
          namingPattern: {
            type: 'string',
            description: 'Naming pattern for new groups (e.g., "Module" creates "Module 1", "Module 2", etc.)',
          },
        },
        required: ['numberOfGroups'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'regroup_by_function',
      description: `Reorganize a group's areas into smaller functional subgroups based on their purpose/type. Use when user says "split into functional groups", "reorganize by function", "break into categories", or "create subgroups based on type". This analyzes area names and purposes to create logical subgroups (e.g., "Supporting facilities" → "Toilets", "Storage", "Circulation"). Does NOT split areas numerically - use split_group for that.`,
      parameters: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: 'ID of the group to reorganize. If not provided, uses selected group.',
          },
          groupName: {
            type: 'string',
            description: 'Name of the group to reorganize. Used if groupId not provided.',
          },
          suggestedCategories: {
            type: 'array',
            description: 'Optional list of category names to organize into. If not provided, AI will determine categories automatically.',
            items: { type: 'string' },
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scale_areas',
      description: `Adjust sizes of EXISTING areas only. DO NOT use this to create new programs - use create_program instead. This modifies currently selected areas. Use for requests like "make rooms bigger", "reduce by 20%", "increase by 15%", "decrease areas", "resize lobby to 500 sqm". NEVER use when user says "create", "add", or "design" - those require create_program.`,
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'Type of scaling operation',
            enum: ['increase', 'decrease', 'set', 'redistribute'],
          },
          value: {
            type: 'number',
            description: 'Value for operation - percentage (for increase/decrease) or absolute sqm (for set)',
          },
          unit: {
            type: 'string',
            description: 'Unit of value',
            enum: ['percent', 'sqm'],
          },
          targetAreaIds: {
            type: 'array',
            description: 'IDs of areas to scale. Uses selected areas if not provided.',
            items: { type: 'string' },
          },
        },
        required: ['operation', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'parse_brief',
      description: `Parse a long-form architectural brief or table into structured area program. Use this when user pastes a document, spreadsheet data, or detailed requirements list.`,
      parameters: {
        type: 'object',
        properties: {
          briefText: {
            type: 'string',
            description: 'The brief text to parse',
          },
          format: {
            type: 'string',
            description: 'Format hint for parsing',
            enum: ['text', 'table', 'list', 'mixed'],
          },
        },
        required: ['briefText'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_summary',
      description: `Get a summary of the current project state including total area, number of areas, groups, and top-level structure. Use this to understand what exists before making changes.`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_area',
      description: `Find an area by name or description. Returns matching areas with their IDs. Use this before unfold_area or scale_areas when you need to target a specific area.`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query - area name or description to find',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'respond_to_user',
      description: `Send a final response to the user. Use this when you have completed all requested actions and want to summarize what was done, or when you need to ask a clarifying question.`,
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to send to the user',
          },
          askForConfirmation: {
            type: 'boolean',
            description: 'Whether to ask user to confirm before applying proposals',
          },
        },
        required: ['message'],
      },
    },
  },
];

/**
 * Get tool definition by name
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return AGENT_TOOLS.find(t => t.function.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return AGENT_TOOLS.map(t => t.function.name);
}
