/**
 * Actions Module - Extensible action registry for chat commands
 * 
 * To add a new action:
 * 1. Create actionName.ts following the pattern in createAction.ts
 * 2. Import and it will auto-register via actionRegistry.register()
 * 
 * Actions are self-contained units with:
 * - Pattern matching (triggers)
 * - Validation (prerequisites)
 * - Execution (AI or deterministic)
 * - Proposal generation (output)
 */

// Core registry and types
export * from './registry';

// Import actions to trigger their registration
import './createAction';
import './unfoldAction';
import './organizeAction';
import './parseBriefAction';
import './scaleAction';

// Re-export individual actions for direct access if needed
export { createAction } from './createAction';
export { unfoldAction } from './unfoldAction';
export { organizeAction } from './organizeAction';
export { parseBriefAction } from './parseBriefAction';
export { scaleAction } from './scaleAction';
