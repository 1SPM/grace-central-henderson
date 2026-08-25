/**
 * Unit tests for runErrorMessage — the pure error-code -> user message
 * mapper used by useAgentCommandCentre's runAgent catch. Covers each
 * branch directly rather than only indirectly through a component test.
 */
import { describe, it, expect } from 'vitest';
import { runErrorMessage } from './useAgentCommandCentre';
import { WorkOsApiError } from '../lib/services/workos';

describe('runErrorMessage', () => {
  it('maps a known server error code to a human-readable message', () => {
    expect(runErrorMessage(new WorkOsApiError('agent_run_failed', 500, { error: 'agent_run_failed' })))
      .toBe('The run failed. Try again, or check with an administrator if it keeps happening.');
  });

  it('maps agent_not_implemented to a refresh instruction', () => {
    expect(runErrorMessage(new WorkOsApiError('agent_not_implemented', 501, { error: 'agent_not_implemented' })))
      .toBe("This agent isn't built yet — refresh the page to see current status.");
  });

  it('falls back to the raw code verbatim for an unmapped server error', () => {
    expect(runErrorMessage(new WorkOsApiError('some_new_server_error', 500, { error: 'some_new_server_error' })))
      .toBe('some_new_server_error');
  });

  it('overrides any code with a permission-specific message on 403', () => {
    expect(runErrorMessage(new WorkOsApiError('forbidden', 403, { error: 'forbidden' })))
      .toBe("Your role doesn't include permission to run agents.");
  });

  it('uses a plain Error message when the failure did not come from workosFetch', () => {
    expect(runErrorMessage(new TypeError('Failed to fetch'))).toBe('Failed to fetch');
  });

  it('falls back to a generic message for a non-Error throw', () => {
    expect(runErrorMessage('a string was thrown')).toBe('Something went wrong running this agent.');
  });
});
