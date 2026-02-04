import { useState } from 'react';
import { Heart, FileText, Mail, Phone, CheckCircle, Gift, Building, Landmark, BookOpen } from 'lucide-react';

interface MemberLegacyPageProps {
  churchName?: string;
  personId?: string;
  personName?: string;
}

interface InterestForm {
  name: string;
  email: string;
  phone: string;
  giftTypes: string[];
  message: string;
  contactPreference: 'email' | 'phone' | 'either';
}

const giftTypeOptions = [
  { id: 'will', label: 'Bequest in Will', icon: FileText, description: 'Include the church in your will or trust' },
  { id: 'beneficiary', label: 'Beneficiary Designation', icon: Landmark, description: 'Name the church as a beneficiary of retirement accounts or life insurance' },
  { id: 'charitable-trust', label: 'Charitable Trust', icon: Building, description: 'Create a trust that benefits you and the church' },
  { id: 'donor-advised', label: 'Donor Advised Fund', icon: Gift, description: 'Establish a fund for ongoing charitable giving' },
  { id: 'real-estate', label: 'Real Estate Gift', icon: Building, description: 'Donate property or real estate' },
  { id: 'stock', label: 'Stock or Securities', icon: Landmark, description: 'Transfer appreciated securities' },
  { id: 'other', label: 'Other / Not Sure', icon: BookOpen, description: 'Learn more about options' },
];

export function MemberLegacyPage({ churchName = 'Grace Church', personName }: MemberLegacyPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<InterestForm>({
    name: personName || '',
    email: '',
    phone: '',
    giftTypes: [],
    message: '',
    contactPreference: 'email'
  });

  const toggleGiftType = (id: string) => {
    setForm(prev => ({
      ...prev,
      giftTypes: prev.giftTypes.includes(id)
        ? prev.giftTypes.filter(t => t !== id)
        : [...prev.giftTypes, id]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the form to the backend
    console.log('Legacy giving interest form submitted:', form);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="px-4 py-8">
        <div className="bg-white dark:bg-dark-850 rounded-2xl p-8 text-center max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100 mb-2">
            Thank You for Your Interest
          </h2>
          <p className="text-gray-600 dark:text-dark-400 mb-6">
            Your interest in supporting {churchName} through planned giving means so much to us.
            A member of our team will reach out to you soon to discuss your options.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setShowForm(false);
              setForm({
                name: personName || '',
                email: '',
                phone: '',
                giftTypes: [],
                message: '',
                contactPreference: 'email'
              });
            }}
            className="text-indigo-600 dark:text-indigo-400 font-medium"
          >
            Back to Legacy Giving
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold mb-2">Leave a Lasting Legacy</h1>
            <p className="text-white/90 text-sm leading-relaxed">
              Your planned gift can make a lasting impact on {churchName} and future generations.
              Legacy giving helps ensure the church's mission continues for years to come.
            </p>
          </div>
        </div>
      </div>

      {!showForm ? (
        <>
          {/* Gift Types */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-4">
              Ways to Give
            </h2>
            <div className="space-y-3">
              {giftTypeOptions.slice(0, 4).map(({ id, label, icon: Icon, description }) => (
                <div
                  key={id}
                  className="bg-white dark:bg-dark-850 rounded-xl p-4 flex items-start gap-3 shadow-sm"
                >
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-dark-100">{label}</h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits Section */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
            <h3 className="font-medium text-amber-900 dark:text-amber-200 mb-2">
              Benefits of Legacy Giving
            </h3>
            <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Potential tax benefits for you and your estate</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Support the church's mission for generations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Create a meaningful family tradition</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Flexible options to fit your situation</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              I'm Interested in Legacy Giving
            </button>
            <p className="text-xs text-center text-gray-500 dark:text-dark-400">
              We'll connect you with resources and answer any questions
            </p>
          </div>

          {/* Contact Info */}
          <div className="bg-white dark:bg-dark-850 rounded-xl p-4 shadow-sm">
            <h3 className="font-medium text-gray-900 dark:text-dark-100 mb-3">
              Have Questions?
            </h3>
            <div className="space-y-2">
              <a
                href="tel:+15551234567"
                className="flex items-center gap-3 text-gray-600 dark:text-dark-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">(555) 123-4567</span>
              </a>
              <a
                href="mailto:legacy@gracechurch.org"
                className="flex items-center gap-3 text-gray-600 dark:text-dark-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm">legacy@gracechurch.org</span>
              </a>
            </div>
          </div>
        </>
      ) : (
        /* Interest Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-dark-850 rounded-xl p-4 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-dark-100">
              Express Your Interest
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                Preferred Contact Method
              </label>
              <div className="flex gap-4">
                {(['email', 'phone', 'either'] as const).map(pref => (
                  <label key={pref} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="contactPreference"
                      checked={form.contactPreference === pref}
                      onChange={() => setForm(prev => ({ ...prev, contactPreference: pref }))}
                      className="text-indigo-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-300 capitalize">{pref}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-850 rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-dark-100">
              I'm interested in learning about:
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {giftTypeOptions.map(({ id, label, icon: Icon }) => (
                <label
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    form.giftTypes.includes(id)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.giftTypes.includes(id)}
                    onChange={() => toggleGiftType(id)}
                    className="sr-only"
                  />
                  <Icon className={`w-5 h-5 ${
                    form.giftTypes.includes(id)
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-400 dark:text-dark-500'
                  }`} />
                  <span className={`text-sm font-medium ${
                    form.giftTypes.includes(id)
                      ? 'text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-700 dark:text-dark-300'
                  }`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-dark-850 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Additional Comments (Optional)
            </label>
            <textarea
              value={form.message}
              onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 resize-none"
              placeholder="Any questions or specific interests..."
            />
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              Submit Interest
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="w-full text-gray-600 dark:text-dark-400 py-2 text-sm"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-center text-gray-500 dark:text-dark-400">
            Your information is confidential and will only be used to connect you with legacy giving resources.
          </p>
        </form>
      )}
    </div>
  );
}
