import { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Heart,
  Flower2,
  Sparkles,
  Baby,
  Users,
  Calendar,
  MapPin,
  Phone,
  Mail,
  User,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { ServiceType, Person, CalendarEvent } from '../types';

interface ServiceRequestFormProps {
  onClose: () => void;
  onSubmit: (request: ServiceRequestData) => void;
  people: Person[];
  events: CalendarEvent[];
  initialType?: ServiceType;
}

interface ServiceRequestData {
  type: ServiceType;
  // Contact info
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  primaryContactId?: string;
  // Basic details
  requestedDate?: string;
  requestedTime?: string;
  location?: string;
  notes?: string;
  // Wedding specific
  partner1Name?: string;
  partner1Id?: string;
  partner2Name?: string;
  partner2Id?: string;
  ceremonyType?: string;
  expectedGuests?: number;
  needsCounseling?: boolean;
  // Funeral specific
  deceasedName?: string;
  deceasedId?: string;
  dateOfDeath?: string;
  serviceType?: string;
  // Baptism specific
  candidateName?: string;
  candidateId?: string;
  isBelieverssBaptism?: boolean;
  parentNames?: string;
  testimony?: string;
  // Dedication specific
  childName?: string;
  childDateOfBirth?: string;
  parentIds?: string[];
}

const serviceTypeInfo = {
  wedding: {
    icon: Heart,
    label: 'Wedding',
    color: 'rose',
    description: 'Plan a wedding ceremony',
  },
  funeral: {
    icon: Flower2,
    label: 'Funeral / Memorial',
    color: 'purple',
    description: 'Arrange a funeral or memorial service',
  },
  baptism: {
    icon: Sparkles,
    label: 'Baptism',
    color: 'blue',
    description: 'Request a baptism service',
  },
  dedication: {
    icon: Baby,
    label: 'Baby Dedication',
    color: 'amber',
    description: 'Schedule a baby dedication',
  },
  counseling: {
    icon: Users,
    label: 'Counseling',
    color: 'green',
    description: 'Request counseling sessions',
  },
  other: {
    icon: Calendar,
    label: 'Other Service',
    color: 'gray',
    description: 'Request another type of service',
  },
};

export function ServiceRequestForm({
  onClose,
  onSubmit,
  people,
  events,
  initialType,
}: ServiceRequestFormProps) {
  const [step, setStep] = useState(initialType ? 2 : 1);
  const [formData, setFormData] = useState<ServiceRequestData>({
    type: initialType || 'wedding',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
  });
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showPersonSearch, setShowPersonSearch] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [dateConflicts, setDateConflicts] = useState<CalendarEvent[]>([]);

  const updateForm = (updates: Partial<ServiceRequestData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const selectServiceType = (type: ServiceType) => {
    updateForm({ type });
    setStep(2);
  };

  const selectPerson = (person: Person) => {
    setSelectedPerson(person);
    updateForm({
      primaryContactId: person.id,
      primaryContactName: `${person.firstName} ${person.lastName}`,
      primaryContactEmail: person.email,
      primaryContactPhone: person.phone,
    });
    setShowPersonSearch(false);
    setPersonSearch('');
  };

  const checkDateConflicts = (date: string) => {
    const conflicts = events.filter((event) => {
      const eventDate = event.startDate.split('T')[0];
      return eventDate === date && (event.category === 'wedding' || event.category === 'funeral');
    });
    setDateConflicts(conflicts);
    return conflicts;
  };

  const handleDateChange = (date: string) => {
    updateForm({ requestedDate: date });
    checkDateConflicts(date);
  };

  const filteredPeople = people.filter((p) => {
    const searchLower = personSearch.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(searchLower) ||
      p.lastName.toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower)
    );
  }).slice(0, 5);

  const handleSubmit = () => {
    onSubmit(formData);
    onClose();
  };

  const canProceed = () => {
    switch (step) {
      case 2:
        return (
          formData.primaryContactName &&
          formData.primaryContactEmail &&
          formData.primaryContactPhone
        );
      case 3:
        if (formData.type === 'wedding') {
          return formData.partner1Name && formData.partner2Name;
        }
        if (formData.type === 'funeral') {
          return formData.deceasedName && formData.dateOfDeath;
        }
        if (formData.type === 'baptism') {
          return formData.candidateName;
        }
        if (formData.type === 'dedication') {
          return formData.childName && formData.childDateOfBirth;
        }
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const totalSteps = 4;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              New Service Request
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-400">
              Step {step} of {totalSteps}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pt-4">
          <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1: Select Service Type */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">
                What type of service do you need?
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(serviceTypeInfo) as [ServiceType, typeof serviceTypeInfo.wedding][]).map(
                  ([type, info]) => {
                    const Icon = info.icon;
                    const isSelected = formData.type === type;
                    return (
                      <button
                        key={type}
                        onClick={() => selectServiceType(type)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                            : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                        }`}
                      >
                        <Icon
                          size={24}
                          className={isSelected ? 'text-violet-600' : 'text-gray-400'}
                        />
                        <h4 className="font-medium text-gray-900 dark:text-dark-100 mt-2">
                          {info.label}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-dark-400">
                          {info.description}
                        </p>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">
                Contact Information
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                Who should we contact about this {serviceTypeInfo[formData.type].label.toLowerCase()}?
              </p>

              {/* Link to existing person */}
              <div className="relative">
                <button
                  onClick={() => setShowPersonSearch(!showPersonSearch)}
                  className="w-full flex items-center gap-2 px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors text-left"
                >
                  <Users size={18} className="text-gray-400" />
                  <span className="text-gray-600 dark:text-dark-400">
                    {selectedPerson
                      ? `${selectedPerson.firstName} ${selectedPerson.lastName}`
                      : 'Link to existing member (optional)'}
                  </span>
                </button>

                {showPersonSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-lg z-10">
                    <input
                      type="text"
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full px-4 py-2 border-b border-gray-200 dark:border-dark-600 bg-transparent text-gray-900 dark:text-dark-100"
                      autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto">
                      {filteredPeople.map((person) => (
                        <button
                          key={person.id}
                          onClick={() => selectPerson(person)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm font-medium text-violet-600 dark:text-violet-400">
                            {person.firstName[0]}
                            {person.lastName[0]}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-dark-100">
                              {person.firstName} {person.lastName}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-dark-400">
                              {person.email}
                            </div>
                          </div>
                        </button>
                      ))}
                      {filteredPeople.length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-dark-400">
                          No members found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    <User size={14} className="inline mr-1" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.primaryContactName}
                    onChange={(e) => updateForm({ primaryContactName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    <Mail size={14} className="inline mr-1" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.primaryContactEmail}
                    onChange={(e) => updateForm({ primaryContactEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    <Phone size={14} className="inline mr-1" />
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={formData.primaryContactPhone}
                    onChange={(e) => updateForm({ primaryContactPhone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Service-Specific Details */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">
                {serviceTypeInfo[formData.type].label} Details
              </h3>

              {/* Wedding Details */}
              {formData.type === 'wedding' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                        Partner 1 Name *
                      </label>
                      <input
                        type="text"
                        value={formData.partner1Name || ''}
                        onChange={(e) => updateForm({ partner1Name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                        Partner 2 Name *
                      </label>
                      <input
                        type="text"
                        value={formData.partner2Name || ''}
                        onChange={(e) => updateForm({ partner2Name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Ceremony Type
                    </label>
                    <select
                      value={formData.ceremonyType || 'traditional'}
                      onChange={(e) => updateForm({ ceremonyType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                    >
                      <option value="traditional">Traditional</option>
                      <option value="contemporary">Contemporary</option>
                      <option value="outdoor">Outdoor</option>
                      <option value="destination">Destination</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Expected Number of Guests
                    </label>
                    <input
                      type="number"
                      value={formData.expectedGuests || ''}
                      onChange={(e) => updateForm({ expectedGuests: parseInt(e.target.value) || undefined })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                      placeholder="150"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.needsCounseling ?? true}
                      onChange={(e) => updateForm({ needsCounseling: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-dark-300">
                      Pre-marital counseling required
                    </span>
                  </label>
                </div>
              )}

              {/* Funeral Details */}
              {formData.type === 'funeral' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Name of Deceased *
                    </label>
                    <input
                      type="text"
                      value={formData.deceasedName || ''}
                      onChange={(e) => updateForm({ deceasedName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Date of Passing *
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfDeath || ''}
                      onChange={(e) => updateForm({ dateOfDeath: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Service Type
                    </label>
                    <select
                      value={formData.serviceType || 'funeral'}
                      onChange={(e) => updateForm({ serviceType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                    >
                      <option value="funeral">Traditional Funeral</option>
                      <option value="memorial">Memorial Service</option>
                      <option value="graveside">Graveside Service</option>
                      <option value="celebration-of-life">Celebration of Life</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Baptism Details */}
              {formData.type === 'baptism' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Name of Person Being Baptized *
                    </label>
                    <input
                      type="text"
                      value={formData.candidateName || ''}
                      onChange={(e) => updateForm({ candidateName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                      Type of Baptism
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.isBelieverssBaptism === true}
                          onChange={() => updateForm({ isBelieverssBaptism: true })}
                          className="w-4 h-4 border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-dark-300">
                          Believer's Baptism
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.isBelieverssBaptism === false}
                          onChange={() => updateForm({ isBelieverssBaptism: false })}
                          className="w-4 h-4 border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-dark-300">
                          Infant Baptism
                        </span>
                      </label>
                    </div>
                  </div>
                  {formData.isBelieverssBaptism === false && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                        Parent Names
                      </label>
                      <input
                        type="text"
                        value={formData.parentNames || ''}
                        onChange={(e) => updateForm({ parentNames: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                      />
                    </div>
                  )}
                  {formData.isBelieverssBaptism === true && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                        Testimony (optional)
                      </label>
                      <textarea
                        value={formData.testimony || ''}
                        onChange={(e) => updateForm({ testimony: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 resize-none"
                        placeholder="Share your faith journey..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Dedication Details */}
              {formData.type === 'dedication' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Child's Name *
                    </label>
                    <input
                      type="text"
                      value={formData.childName || ''}
                      onChange={(e) => updateForm({ childName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Child's Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={formData.childDateOfBirth || ''}
                      onChange={(e) => updateForm({ childDateOfBirth: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Counseling & Other - just notes */}
              {(formData.type === 'counseling' || formData.type === 'other') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Please describe what you need
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => updateForm({ notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 resize-none"
                    placeholder="Tell us more about your needs..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Date & Location */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">
                Preferred Date & Location
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Preferred Date
                </label>
                <input
                  type="date"
                  value={formData.requestedDate || ''}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>

              {dateConflicts.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Potential scheduling conflict
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        There are {dateConflicts.length} other service(s) scheduled for this date.
                        We'll work with you to find a suitable time.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Preferred Time
                </label>
                <input
                  type="time"
                  value={formData.requestedTime || ''}
                  onChange={(e) => updateForm({ requestedTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  <MapPin size={14} className="inline mr-1" />
                  Preferred Location
                </label>
                <select
                  value={formData.location || ''}
                  onChange={(e) => updateForm({ location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="">Select a location...</option>
                  <option value="Main Sanctuary">Main Sanctuary</option>
                  <option value="Chapel">Chapel</option>
                  <option value="Fellowship Hall">Fellowship Hall</option>
                  <option value="Outdoor Garden">Outdoor Garden</option>
                  <option value="Off-site">Off-site Location</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 resize-none"
                  placeholder="Any special requests or additional information..."
                />
              </div>

              {/* Summary */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-dark-100 mb-2">
                  Request Summary
                </h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-dark-400">Service Type:</dt>
                    <dd className="font-medium text-gray-900 dark:text-dark-100">
                      {serviceTypeInfo[formData.type].label}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-dark-400">Contact:</dt>
                    <dd className="font-medium text-gray-900 dark:text-dark-100">
                      {formData.primaryContactName}
                    </dd>
                  </div>
                  {formData.requestedDate && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-dark-400">Requested Date:</dt>
                      <dd className="font-medium text-gray-900 dark:text-dark-100">
                        {new Date(formData.requestedDate).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                  {formData.location && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-dark-400">Location:</dt>
                      <dd className="font-medium text-gray-900 dark:text-dark-100">
                        {formData.location}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-dark-700">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 px-4 py-2 text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              <ChevronLeft size={18} />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              <Check size={18} />
              Submit Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
