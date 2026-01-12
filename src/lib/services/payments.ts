/**
 * Payment Service - Stripe Integration
 *
 * Provides payment processing capabilities using Stripe.
 * Handles one-time and recurring donations/giving.
 */

import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'us_bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  bankAccount?: {
    bankName: string;
    last4: string;
  };
}

export interface CreatePaymentParams {
  amount: number; // in cents
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
  customerId?: string;
  paymentMethodId?: string;
  fund?: string;
}

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  error?: string;
  status?: string;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  status?: string;
  error?: string;
}

export interface CustomerResult {
  success: boolean;
  customerId?: string;
  error?: string;
}

// Fund types for giving
export const GIVING_FUNDS = [
  { id: 'tithe', name: 'Tithe', description: 'General tithe' },
  { id: 'offering', name: 'Offering', description: 'General offering' },
  { id: 'missions', name: 'Missions', description: 'Support for missionaries' },
  { id: 'building', name: 'Building Fund', description: 'Building projects' },
  { id: 'benevolence', name: 'Benevolence', description: 'Help those in need' },
  { id: 'youth', name: 'Youth Ministry', description: 'Youth programs' },
  { id: 'other', name: 'Other', description: 'Other designated giving' },
];

// Recurring giving intervals
export const RECURRING_INTERVALS = [
  { id: 'week', name: 'Weekly' },
  { id: 'month', name: 'Monthly' },
  { id: 'quarter', name: 'Quarterly' },
  { id: 'year', name: 'Annually' },
];

class PaymentService {
  private publishableKey: string | null = null;
  private stripe: Stripe | null = null;
  private stripePromise: Promise<Stripe | null> | null = null;
  private apiBaseUrl: string = '/api/payments'; // Your backend API

  configure(config: { publishableKey: string; apiBaseUrl?: string }) {
    this.publishableKey = config.publishableKey;
    if (config.apiBaseUrl) this.apiBaseUrl = config.apiBaseUrl;
    this.stripePromise = loadStripe(this.publishableKey);
  }

  isConfigured(): boolean {
    return !!this.publishableKey;
  }

  async getStripe(): Promise<Stripe | null> {
    if (!this.stripePromise) {
      return null;
    }
    if (!this.stripe) {
      this.stripe = await this.stripePromise;
    }
    return this.stripe;
  }

  // Create or retrieve a Stripe customer
  async createCustomer(data: {
    email: string;
    name: string;
    phone?: string;
    personId: string;
  }): Promise<CustomerResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
          phone: data.phone,
          metadata: {
            grace_crm_person_id: data.personId,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to create customer',
        };
      }

      return {
        success: true,
        customerId: result.customerId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Create a payment intent for one-time giving
  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.publishableKey) {
      return {
        success: false,
        error: 'Payment service not configured. Please set your Stripe publishable key.',
      };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency || 'usd',
          description: params.description,
          metadata: {
            ...params.metadata,
            fund: params.fund,
          },
          customer: params.customerId,
          payment_method: params.paymentMethodId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to create payment intent',
        };
      }

      return {
        success: true,
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        status: result.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Confirm a payment with the client secret
  async confirmPayment(
    clientSecret: string,
    elements: StripeElements,
    returnUrl: string
  ): Promise<PaymentResult> {
    const stripe = await this.getStripe();
    if (!stripe) {
      return {
        success: false,
        error: 'Stripe not initialized',
      };
    }

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        paymentIntentId: paymentIntent?.id,
        status: paymentIntent?.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment confirmation failed',
      };
    }
  }

  // Create a subscription for recurring giving
  async createSubscription(
    params: CreateSubscriptionParams
  ): Promise<SubscriptionResult> {
    if (!this.publishableKey) {
      return {
        success: false,
        error: 'Payment service not configured',
      };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to create subscription',
        };
      }

      return {
        success: true,
        subscriptionId: result.subscriptionId,
        status: result.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/subscriptions/${subscriptionId}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to cancel subscription',
        };
      }

      return {
        success: true,
        subscriptionId,
        status: 'canceled',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Get customer's payment methods
  async getPaymentMethods(customerId: string): Promise<{
    success: boolean;
    paymentMethods?: PaymentMethod[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/customers/${customerId}/payment-methods`
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to get payment methods',
        };
      }

      return {
        success: true,
        paymentMethods: result.paymentMethods,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Get giving history for a customer
  async getGivingHistory(customerId: string): Promise<{
    success: boolean;
    payments?: Array<{
      id: string;
      amount: number;
      fund: string;
      date: string;
      status: string;
    }>;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/customers/${customerId}/payments`
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to get giving history',
        };
      }

      return {
        success: true,
        payments: result.payments,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Get giving summary/statistics
  async getGivingSummary(
    customerId: string,
    year?: number
  ): Promise<{
    success: boolean;
    summary?: {
      total: number;
      byFund: Record<string, number>;
      byMonth: Record<string, number>;
    };
    error?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (year) params.append('year', year.toString());

      const response = await fetch(
        `${this.apiBaseUrl}/customers/${customerId}/summary?${params}`
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to get giving summary',
        };
      }

      return {
        success: true,
        summary: result.summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Helper to format amount for display
  formatAmount(cents: number, currency: string = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  }

  // Helper to convert dollars to cents
  toCents(dollars: number): number {
    return Math.round(dollars * 100);
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
