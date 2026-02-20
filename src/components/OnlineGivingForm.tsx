import { useState } from 'react';
import {
  Heart,
  DollarSign,
  Repeat,
  CheckCircle,
  ArrowLeft,
  Gift,
  Sparkles,
} from 'lucide-react';
import { createLogger } from '../utils/logger';

const log = createLogger('online-giving');
import { GIVING_FUNDS, RECURRING_INTERVALS } from '../lib/services/payments';
import { StripeCheckoutForm } from './StripeCheckoutForm';

interface OnlineGivingFormProps {
  churchName?: string;
  onBack?: () => void;
  onSuccess?: (donation: {
    amount: number;
    fund: string;
    isRecurring: boolean;
    frequency?: string;
    email: string;
    name: string;
  }) => void;
}

type GivingStep = 'amount' | 'details' | 'payment' | 'success';

const PRESET_AMOUNTS = [25, 50, 100, 250, 500, 1000];

export function OnlineGivingForm({ churchName = 'Grace Church', onBack, onSuccess }: OnlineGivingFormProps) {
  const [step, setStep] = useState<GivingStep>('amount');
  const [amount, setAmount] = useState<string>('');
  const [customAmount, setCustomAmount] = useState(false);
  const [fund, setFund] = useState('tithe');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('month');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [coverFees, setCoverFees] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const processingFee = numericAmount * 0.029 + 0.30; // Typical Stripe fee
  const totalAmount = coverFees ? numericAmount + processingFee : numericAmount;

  const handlePresetAmount = (value: number) => {
    setAmount(value.toString());
    setCustomAmount(false);
  };

  const handleCustomAmount = () => {
    setCustomAmount(true);
    setAmount('');
  };

  const handleContinue = () => {
    if (step === 'amount' && numericAmount >= 1) {
      setStep('details');
    } else if (step === 'details' && email && firstName && lastName) {
      setStep('payment');
    }
  };

  const handlePaymentSuccess = (_paymentId: string) => {
    setStep('success');
    onSuccess?.({
      amount: totalAmount,
      fund,
      isRecurring,
      frequency: isRecurring ? frequency : undefined,
      email,
      name: `${firstName} ${lastName}`,
    });
  };

  const renderAmountStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Heart className="text-white" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Give to {churchName}</h2>
        <p className="text-gray-500 dark:text-dark-400 mt-2">Your generosity makes a difference</p>
      </div>

      {/* Fund Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
          Select Fund
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {GIVING_FUNDS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFund(f.id)}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                fund === f.id
                  ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-400 hover:border-gray-300 dark:hover:border-dark-500'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
          Gift Amount
        </label>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {PRESET_AMOUNTS.map((value) => (
            <button
              key={value}
              onClick={() => handlePresetAmount(value)}
              className={`p-4 rounded-xl border-2 font-bold text-lg transition-all ${
                amount === value.toString() && !customAmount
                  ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 hover:border-gray-300 dark:hover:border-dark-500'
              }`}
            >
              ${value}
            </button>
          ))}
        </div>
        <button
          onClick={handleCustomAmount}
          className={`w-full p-4 rounded-xl border-2 font-medium transition-all ${
            customAmount
              ? 'border-green-500 bg-green-50 dark:bg-green-500/10'
              : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
          }`}
        >
          {customAmount ? (
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full pl-10 pr-4 py-2 bg-transparent text-center text-xl font-bold focus:outline-none text-gray-900 dark:text-dark-100"
                autoFocus
                min="1"
                step="0.01"
              />
            </div>
          ) : (
            <span className="text-gray-600 dark:text-dark-400">Custom Amount</span>
          )}
        </button>
      </div>

      {/* Recurring Toggle */}
      <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Repeat className="text-purple-500" size={20} />
            <div>
              <p className="font-medium text-gray-900 dark:text-dark-100">Make this recurring</p>
              <p className="text-sm text-gray-500 dark:text-dark-400">Set up automatic giving</p>
            </div>
          </div>
          <button
            onClick={() => setIsRecurring(!isRecurring)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              isRecurring ? 'bg-purple-500' : 'bg-gray-300 dark:bg-dark-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                isRecurring ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {isRecurring && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {RECURRING_INTERVALS.map((interval) => (
              <button
                key={interval.id}
                onClick={() => setFrequency(interval.id)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  frequency === interval.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-white dark:bg-dark-700 text-gray-600 dark:text-dark-400 border border-gray-200 dark:border-dark-600'
                }`}
              >
                {interval.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleContinue}
        disabled={numericAmount < 1}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all"
      >
        Continue with ${numericAmount.toFixed(2)} {isRecurring && `/ ${frequency}`}
      </button>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <button
        onClick={() => setStep('amount')}
        className="flex items-center gap-2 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100">Your Information</h2>
        <p className="text-gray-500 dark:text-dark-400 mt-1">For your receipt and tax records</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              placeholder="Smith"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            placeholder="john@example.com"
          />
        </div>

        {/* Cover Processing Fees */}
        <label className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={coverFees}
            onChange={(e) => setCoverFees(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-dark-100">
              Cover processing fees (+${processingFee.toFixed(2)})
            </p>
            <p className="text-sm text-gray-500 dark:text-dark-400">
              100% of your gift goes to the church
            </p>
          </div>
          <Gift className="text-amber-500" size={24} />
        </label>
      </div>

      <button
        onClick={handleContinue}
        disabled={!email || !firstName || !lastName}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all"
      >
        Continue to Payment
      </button>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <button
        onClick={() => setStep('details')}
        className="flex items-center gap-2 text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100">Payment Method</h2>
        <p className="text-gray-500 dark:text-dark-400 mt-1">Secure payment powered by Stripe</p>
      </div>

      {/* Order Summary */}
      <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-dark-400">Gift Amount</span>
          <span className="font-medium text-gray-900 dark:text-dark-100">${numericAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-dark-400">Fund</span>
          <span className="font-medium text-gray-900 dark:text-dark-100 capitalize">{fund}</span>
        </div>
        {coverFees && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-dark-400">Processing Fee</span>
            <span className="font-medium text-gray-900 dark:text-dark-100">${processingFee.toFixed(2)}</span>
          </div>
        )}
        {isRecurring && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-dark-400">Frequency</span>
            <span className="font-medium text-purple-600 dark:text-purple-400 capitalize">{frequency}ly</span>
          </div>
        )}
        <div className="border-t border-gray-200 dark:border-dark-600 pt-3 flex justify-between">
          <span className="font-semibold text-gray-900 dark:text-dark-100">Total</span>
          <span className="font-bold text-lg text-green-600 dark:text-green-400">${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Stripe Checkout Form */}
      <StripeCheckoutForm
        amount={totalAmount}
        fund={fund}
        email={email}
        name={`${firstName} ${lastName}`}
        isRecurring={isRecurring}
        frequency={frequency}
        coverFees={coverFees}
        onSuccess={handlePaymentSuccess}
        onError={(err) => log.error('Payment error', err)}
      />
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="text-white" size={40} />
      </div>

      <div className="mb-6">
        <Sparkles className="inline-block text-yellow-500 mb-2" size={24} />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Thank You!</h2>
        <p className="text-gray-500 dark:text-dark-400 mt-2">
          Your gift of <span className="font-bold text-green-600">${totalAmount.toFixed(2)}</span> has been received
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-6 text-left space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-dark-400">Amount</span>
          <span className="font-medium text-gray-900 dark:text-dark-100">${totalAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-dark-400">Fund</span>
          <span className="font-medium text-gray-900 dark:text-dark-100 capitalize">{fund}</span>
        </div>
        {isRecurring && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-dark-400">Frequency</span>
            <span className="font-medium text-purple-600 dark:text-purple-400 capitalize">{frequency}ly</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-dark-400">Receipt sent to</span>
          <span className="font-medium text-gray-900 dark:text-dark-100">{email}</span>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-dark-400 mb-6">
        A receipt has been sent to your email for your tax records.
      </p>

      <button
        onClick={() => {
          setStep('amount');
          setAmount('');
          setIsRecurring(false);
          onBack?.();
        }}
        className="px-6 py-3 bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
      >
        Give Again
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-dark-900 dark:to-dark-850 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-dark-850 rounded-3xl shadow-xl p-8">
        {onBack && step !== 'success' && (
          <button
            onClick={onBack}
            className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
          >
            <ArrowLeft size={24} />
          </button>
        )}

        {step === 'amount' && renderAmountStep()}
        {step === 'details' && renderDetailsStep()}
        {step === 'payment' && renderPaymentStep()}
        {step === 'success' && renderSuccessStep()}
      </div>
    </div>
  );
}
