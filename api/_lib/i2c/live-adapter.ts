/**
 * Live i2c adapter — HTTP client for i2cInc merchant services (TD-036).
 * Throws until I2C_API_BASE and payload mapping are configured.
 */

import type { I2cAdapter } from './types.js';

function notImplemented(method: string): never {
  throw new Error(`i2c live adapter: ${method} not yet implemented (TD-036)`);
}

export const liveI2cAdapter: I2cAdapter = {
  mode: 'live',
  submitKyc: () => Promise.reject(notImplemented('submitKyc')),
  issueCard: () => Promise.reject(notImplemented('issueCard')),
  freezeCard: () => Promise.reject(notImplemented('freezeCard')),
  unfreezeCard: () => Promise.reject(notImplemented('unfreezeCard')),
  cancelCard: () => Promise.reject(notImplemented('cancelCard')),
  getBalance: () => Promise.reject(notImplemented('getBalance')),
  getDepositInstructions: () => Promise.reject(notImplemented('getDepositInstructions')),
  initiateTransfer: () => Promise.reject(notImplemented('initiateTransfer')),
};
