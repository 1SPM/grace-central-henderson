import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { createLogger } from '../utils/logger';

const log = createLogger('stripe-checkout');
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  CreditCard,
  Lock,
  AlertCircle,
  Building2,
  Loader2,
} from 'lucide-react';

interface StripeCheckoutFormProps {
  amount: number;
  fund: string;
  email: string;
  name: string;
  isRecurring: boolean;
  frequency?: string;
  coverFees: boolean;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
}

interface CheckoutFormInnerProps {
  amount: number;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}

// Get Stripe publishable key from environment or settings
const getStripePublishableKey = (): string | null => {
  // Check for environment variable
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY) {
    return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  }

  // Check localStorage for configured key
  const storedKey = localStorage.getItem('stripe-publishable-key');
  if (storedKey) return storedKey;

  return null;
};

function CheckoutFormInner({
  amount,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
}: CheckoutFormInnerProps) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/giving/success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed');
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      }
    } catch {
      onError('An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      <button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock size={18} />
            Pay ${amount.toFixed(2)}
          </>
        )}
      </button>
    </form>
  );
}

// Demo mode card form for when Stripe is not configured
function DemoCardForm({
  amount,
  onSuccess,
  isProcessing,
  setIsProcessing,
}: {
  amount: number;
  onSuccess: (paymentId: string) => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate a mock payment ID
    const mockPaymentId = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    onSuccess(mockPaymentId);
  };

  const isValid = paymentMethod === 'card'
    ? cardNumber.replace(/\s/g, '').length >= 15 && expiry.length >= 4 && cvc.length >= 3
    : true; // For bank, we'd have different validation

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Method Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-dark-800 rounded-xl">
        <button
          type="button"
          onClick={() => setPaymentMethod('card')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
            paymentMethod === 'card'
              ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
              : 'text-gray-500 dark:text-dark-400'
          }`}
        >
          <CreditCard size={18} />
          Card
        </button>
        <button
          type="button"
          onClick={() => setPaymentMethod('bank')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
            paymentMethod === 'bank'
              ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
              : 'text-gray-500 dark:text-dark-400'
          }`}
        >
          <Building2 size={18} />
          Bank
        </button>
      </div>

      {paymentMethod === 'card' ? (
        <div className="space-y-4">
          {/* Card Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Card Number
            </label>
            <div className="relative">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                className="w-full px-4 py-3 pr-12 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
              <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>

          {/* Expiry and CVC */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Expiry Date
              </label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                maxLength={5}
                className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                CVC
              </label>
              <input
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                maxLength={4}
                className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-6 text-center">
          <Building2 className="mx-auto mb-3 text-blue-500" size={32} />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Bank account (ACH) payments require Stripe configuration.
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
            Configure your Stripe API key in settings to enable bank transfers.
          </p>
        </div>
      )}

      {/* Demo Notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
        <AlertCircle className="text-amber-500 mt-0.5" size={18} />
        <div className="text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">Demo Mode</p>
          <p className="text-amber-600 dark:text-amber-300">
            Stripe is not configured. Payments will be simulated.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={!isValid || isProcessing}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock size={18} />
            Pay ${amount.toFixed(2)}
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400 dark:text-dark-500">
        <Lock size={12} className="inline mr-1" />
        Your payment information is secure and encrypted
      </p>
    </form>
  );
}

export function StripeCheckoutForm({
  amount,
  fund,
  email,
  name,
  isRecurring,
  frequency,
  coverFees,
  onSuccess,
  onError,
}: StripeCheckoutFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [useDemo, setUseDemo] = useState(false);

  useEffect(() => {
    const initializePayment = async () => {
      const publishableKey = getStripePublishableKey();

      if (!publishableKey) {
        setUseDemo(true);
        setIsLoading(false);
        return;
      }

      try {
        // Initialize Stripe
        setStripePromise(loadStripe(publishableKey));

        // Create payment intent via API
        const response = await fetch('/api/payments/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            description: `${fund} donation`,
            metadata: {
              fund,
              email,
              name,
              isRecurring: isRecurring.toString(),
              frequency: frequency || '',
              coverFees: coverFees.toString(),
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create payment intent');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch {
        // If API call fails, fall back to demo mode
        log.warn('Stripe API not available, using demo mode');
        setUseDemo(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializePayment();
  }, [amount, fund, email, name, isRecurring, frequency, coverFees]);

  const handleDemoSuccess = (paymentId: string) => {
    setIsProcessing(false);
    onSuccess(paymentId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-green-500" size={32} />
      </div>
    );
  }

  // Use demo mode if Stripe is not configured or API is not available
  if (useDemo) {
    return (
      <DemoCardForm
        amount={amount}
        onSuccess={handleDemoSuccess}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
      />
    );
  }

  // Use real Stripe Elements
  if (stripePromise && clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#10b981',
              borderRadius: '12px',
            },
          },
        }}
      >
        <CheckoutFormInner
          amount={amount}
          onSuccess={onSuccess}
          onError={onError}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      </Elements>
    );
  }

  // Fallback to demo
  return (
    <DemoCardForm
      amount={amount}
      onSuccess={handleDemoSuccess}
      isProcessing={isProcessing}
      setIsProcessing={setIsProcessing}
    />
  );
}
