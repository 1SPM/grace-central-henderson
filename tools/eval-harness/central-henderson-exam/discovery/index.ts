/**
 * Central Henderson Discovery / Workshop Instrument — entry point.
 *
 * Converts the Central Henderson GRACE Qualification Exam's empirical
 * findings (../knowledge-gap-map.ts, ../pilot-priority-ranking.ts) into a
 * structured discovery instrument for a real session with Central
 * Henderson leadership. See discovery-items.ts for the core traceable
 * data and the qualification↔discovery lifecycle this instrument feeds.
 *
 * This is a design/documentation artifact — it does not ingest data,
 * wire a new source into chat, or change the Capability Baseline. See
 * docs/CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md (Central-facing) and
 * docs/CENTRAL_HENDERSON_DISCOVERY_TECHNICAL_SPEC.md (internal) for the
 * two rendered output layers.
 */
export * from './discovery-items.js';
export * from './systems-of-record.js';
export * from './authority-sensitivity-map.js';
export * from './show-us-dont-tell-us.js';
export * from './source-register.js';
export * from './workshop-outputs.js';
export * from './workshop-playbook.js';
