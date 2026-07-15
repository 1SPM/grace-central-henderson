/**
 * Gemini function-calling declarations for the 14 assistant tools.
 * Shape matches Gemini's REST `tools[].functionDeclarations[]` —
 * see https://ai.google.dev/api/caching#FunctionDeclaration.
 *
 * These are a SHAPE contract only (types, enums, required fields) — the
 * real business-rule validation happens again inside each tool in
 * api/_lib/assistant/tools.ts. Never trust the model's arguments as
 * pre-validated just because they matched this schema.
 */

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export const ASSISTANT_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: 'get_my_profile',
    description: "Get the member's own name, email, and phone on file. Use to answer 'what's my info' style questions.",
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'update_my_preferences',
    description: "Update the member's own communication preference for one channel (email, sms, or push notifications).",
    parameters: {
      type: 'OBJECT',
      properties: {
        consent_type: { type: 'STRING', enum: ['email', 'sms', 'push_notification'], description: 'Which communication channel to update.' },
        status: { type: 'STRING', enum: ['granted', 'denied'], description: 'granted = opt in, denied = opt out.' },
      },
      required: ['consent_type', 'status'],
    },
  },
  {
    name: 'list_upcoming_events',
    description: "List the church's upcoming events, including the member's own RSVP status for each.",
    parameters: {
      type: 'OBJECT',
      properties: { limit: { type: 'NUMBER', description: 'Max events to return, 1-10. Defaults to 5.' } },
    },
  },
  {
    name: 'rsvp_to_event',
    description: 'RSVP the member to a specific event by its id (from list_upcoming_events).',
    parameters: {
      type: 'OBJECT',
      properties: {
        event_id: { type: 'STRING', description: 'The event id from list_upcoming_events.' },
        status: { type: 'STRING', enum: ['yes', 'no', 'maybe'] },
        guest_count: { type: 'NUMBER', description: 'Number of additional guests, 0-20.' },
      },
      required: ['event_id', 'status'],
    },
  },
  {
    name: 'list_groups',
    description: "List active small groups at the church, including the member's own membership status for each.",
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'request_group_membership',
    description: 'Request to join a specific group by its id (from list_groups). Creates a pending request for a coordinator to approve.',
    parameters: {
      type: 'OBJECT',
      properties: { group_id: { type: 'STRING', description: 'The group id from list_groups.' } },
      required: ['group_id'],
    },
  },
  {
    name: 'list_volunteer_opportunities',
    description: 'List the volunteer opportunities the church currently has open.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'submit_volunteer_interest',
    description: 'Submit the member\'s interest in a volunteer opportunity by its key (from list_volunteer_opportunities), or "other" for something not listed.',
    parameters: {
      type: 'OBJECT',
      properties: {
        area: { type: 'STRING', description: 'The opportunity key from list_volunteer_opportunities, or "other".' },
        message: { type: 'STRING', description: 'Optional note about their interest or availability.' },
      },
      required: ['area'],
    },
  },
  {
    name: 'start_care_request',
    description: 'Submit a pastoral care request on the member\'s behalf. Use when a member wants to reach out to pastoral care about something personal. Never decide the visibility or urgency yourself beyond what the member states — pass their words through faithfully.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', enum: ['marriage', 'addiction', 'grief', 'faith-questions', 'crisis', 'financial', 'anxiety-depression', 'parenting', 'general'] },
        message: { type: 'STRING', description: "What the member wants pastoral care to know, in the member's own words." },
        preferred_contact_method: { type: 'STRING', enum: ['email', 'sms', 'phone', 'either'] },
        requests_human_followup: { type: 'BOOLEAN', description: 'Whether the member wants a real person to follow up. Defaults to true.' },
        visibility: { type: 'STRING', enum: ['private_pastoral_care', 'specific_care_team'], description: 'Who can see this request. Defaults to private_pastoral_care.' },
      },
      required: ['category', 'message'],
    },
  },
  {
    name: 'get_my_care_request_status',
    description: "Check the status of the member's own previously-submitted care requests.",
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_my_giving_summary',
    description: "Get the member's own giving summary: year-to-date total, whether they have an active recurring gift, and their most recent gift date. Does not include any card, account, or provider numbers.",
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_my_impact_summary',
    description: "Get the member's own Impact Card status: application status, card status, available balance, and current cause routing. Never returns card numbers, account numbers, or routing numbers.",
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'search_approved_church_resources',
    description: 'Search approved, published church information and announcements for a topic (e.g. service times, an upcoming sermon series, a ministry). Also returns basic church contact info. This is the ONLY source of church facts — never state a church fact that did not come from this tool.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'What the member is asking about.' } },
      required: ['query'],
    },
  },
  {
    name: 'request_human_followup',
    description: 'Ask a real staff member to reach out to the member directly, for anything that is not a pastoral care matter (general questions, help with something in the portal, etc).',
    parameters: {
      type: 'OBJECT',
      properties: { message: { type: 'STRING', description: 'What the member would like help with.' } },
      required: ['message'],
    },
  },
];
