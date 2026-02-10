import { useState, useMemo } from 'react';
import {
  FileText,
  DollarSign,
  CheckCircle,
  Circle,
  Plus,
  Edit2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Shield,
  Heart,
  Building,
  ArrowLeft,
  AlertTriangle,
  BookOpen,
  Phone,
  Mail,
} from 'lucide-react';
import type { Person } from '../types';

interface EstatePlan {
  id: string;
  personId?: string;
  personName: string;
  spouseName?: string;
  email?: string;
  phone?: string;
  // Estate Documents
  hasWill: boolean;
  willDate?: string;
  willLocation?: string;
  hasTrust: boolean;
  trustType?: 'revocable' | 'irrevocable' | 'charitable' | 'other';
  trustDate?: string;
  hasPowerOfAttorney: boolean;
  poaAgent?: string;
  hasHealthcareDirective: boolean;
  healthcareAgent?: string;
  // Church-Related Legacy
  churchInWill: boolean;
  churchInTrust: boolean;
  plannedGiftType?: 'bequest' | 'beneficiary' | 'charitable-remainder' | 'gift-annuity' | 'endowment' | 'other';
  plannedGiftAmount?: number;
  plannedGiftPercentage?: number;
  designatedFund?: string;
  giftPurpose?: string;
  // Life Insurance
  hasLifeInsurance: boolean;
  lifeInsuranceChurchBeneficiary: boolean;
  lifeInsuranceAmount?: number;
  // Retirement Accounts
  hasRetirementAccounts: boolean;
  retirementChurchBeneficiary: boolean;
  retirementDesignation?: string;
  // Status
  status: 'inquiry' | 'in-progress' | 'documented' | 'confirmed';
  lastContactDate?: string;
  nextFollowUpDate?: string;
  // Planning checklist
  checklist: EstatePlanChecklistItem[];
  // Notes
  notes: string;
  confidentialNotes?: string;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

interface EstatePlanChecklistItem {
  id: string;
  task: string;
  category: 'documents' | 'beneficiaries' | 'follow-up' | 'education';
  completed: boolean;
  dueDate?: string;
}

interface EstatePlanningProps {
  people: Person[];
  onViewPerson?: (id: string) => void;
  onBack?: () => void;
}

const statusColors: Record<EstatePlan['status'], { bg: string; text: string; label: string }> = {
  inquiry: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Inquiry' },
  'in-progress': { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', label: 'In Progress' },
  documented: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', label: 'Documented' },
  confirmed: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400', label: 'Confirmed' },
};

const plannedGiftTypes: Record<string, string> = {
  bequest: 'Bequest in Will',
  beneficiary: 'Beneficiary Designation',
  'charitable-remainder': 'Charitable Remainder Trust',
  'gift-annuity': 'Charitable Gift Annuity',
  endowment: 'Endowment Gift',
  other: 'Other',
};

const defaultChecklist: Omit<EstatePlanChecklistItem, 'id'>[] = [
  // Documents
  { task: 'Review current will status', category: 'documents', completed: false },
  { task: 'Discuss trust options', category: 'documents', completed: false },
  { task: 'Verify power of attorney', category: 'documents', completed: false },
  { task: 'Review healthcare directive', category: 'documents', completed: false },
  // Beneficiaries
  { task: 'Review life insurance beneficiaries', category: 'beneficiaries', completed: false },
  { task: 'Review retirement account beneficiaries', category: 'beneficiaries', completed: false },
  { task: 'Discuss church as beneficiary', category: 'beneficiaries', completed: false },
  // Education
  { task: 'Provide legacy giving brochure', category: 'education', completed: false },
  { task: 'Discuss planned giving options', category: 'education', completed: false },
  { task: 'Share tax benefit information', category: 'education', completed: false },
  // Follow-up
  { task: 'Schedule follow-up meeting', category: 'follow-up', completed: false },
  { task: 'Connect with estate attorney', category: 'follow-up', completed: false },
  { task: 'Send thank you note', category: 'follow-up', completed: false },
];

const fundOptions = [
  'General Fund',
  'Building Fund',
  'Missions Fund',
  'Youth Ministry',
  'Music Ministry',
  'Benevolence Fund',
  'Scholarship Fund',
  'Endowment Fund',
  'Pastor Discretionary',
  'Other',
];

export function EstatePlanning({ people: _people, onViewPerson: _onViewPerson, onBack }: EstatePlanningProps) {
  const [plans, setPlans] = useState<EstatePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<EstatePlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<EstatePlan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstatePlan['status'] | 'all'>('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    documents: true,
    legacy: true,
    insurance: false,
    checklist: true,
    notes: false,
  });

  // Filter plans
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchesSearch = p.personName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [plans, searchTerm, statusFilter]);

  // Calculate totals
  const legacyStats = useMemo(() => {
    const plansWithGifts = plans.filter(p => p.churchInWill || p.churchInTrust || p.lifeInsuranceChurchBeneficiary || p.retirementChurchBeneficiary);
    const totalExpectedValue = plans.reduce((sum, p) => sum + (p.plannedGiftAmount || 0), 0);
    return {
      totalPlans: plans.length,
      confirmedPlans: plans.filter(p => p.status === 'confirmed').length,
      plansWithGifts: plansWithGifts.length,
      totalExpectedValue,
    };
  }, [plans]);

  const handleAddPlan = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const handleEditPlan = (plan: EstatePlan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleSavePlan = (planData: Partial<EstatePlan>) => {
    if (editingPlan) {
      setPlans(prev => prev.map(p =>
        p.id === editingPlan.id
          ? { ...p, ...planData, updatedAt: new Date().toISOString() }
          : p
      ));
      if (selectedPlan?.id === editingPlan.id) {
        setSelectedPlan(prev => prev ? { ...prev, ...planData, updatedAt: new Date().toISOString() } : null);
      }
    } else {
      const newPlan: EstatePlan = {
        id: `estate-${Date.now()}`,
        personName: planData.personName || '',
        spouseName: planData.spouseName,
        email: planData.email,
        phone: planData.phone,
        hasWill: planData.hasWill || false,
        hasTrust: planData.hasTrust || false,
        hasPowerOfAttorney: planData.hasPowerOfAttorney || false,
        hasHealthcareDirective: planData.hasHealthcareDirective || false,
        churchInWill: planData.churchInWill || false,
        churchInTrust: planData.churchInTrust || false,
        hasLifeInsurance: planData.hasLifeInsurance || false,
        lifeInsuranceChurchBeneficiary: planData.lifeInsuranceChurchBeneficiary || false,
        hasRetirementAccounts: planData.hasRetirementAccounts || false,
        retirementChurchBeneficiary: planData.retirementChurchBeneficiary || false,
        status: 'inquiry',
        checklist: defaultChecklist.map((item, index) => ({
          ...item,
          id: `checklist-${Date.now()}-${index}`,
        })),
        notes: planData.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...planData,
      };
      setPlans(prev => [...prev, newPlan]);
    }
    setShowForm(false);
    setEditingPlan(null);
  };

  const handleToggleChecklistItem = (planId: string, itemId: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      return {
        ...p,
        checklist: p.checklist.map(item =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        ),
        updatedAt: new Date().toISOString(),
      };
    }));
    if (selectedPlan?.id === planId) {
      setSelectedPlan(prev => {
        if (!prev) return null;
        return {
          ...prev,
          checklist: prev.checklist.map(item =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getChecklistProgress = (plan: EstatePlan) => {
    const completed = plan.checklist.filter(item => item.completed).length;
    return { completed, total: plan.checklist.length, percent: Math.round((completed / plan.checklist.length) * 100) };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          <div className="p-2 bg-emerald-100 dark:bg-emerald-500/15 rounded-xl">
            <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estate Planning & Legacy Giving</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Help members plan their legacy and charitable giving
            </p>
          </div>
        </div>
        <button
          onClick={handleAddPlan}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-emerald-600">{legacyStats.totalPlans}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Plans</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-green-600">{legacyStats.confirmedPlans}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Confirmed</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600">{legacyStats.plansWithGifts}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">With Church Gifts</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(legacyStats.totalExpectedValue)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Expected Value</p>
        </div>
      </div>

      {/* Information Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-emerald-900 dark:text-emerald-100">Legacy Giving Resources</h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
              Help members understand how planned gifts can support the church&apos;s mission for generations.
              Common options include bequests, beneficiary designations, and charitable trusts.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EstatePlan['status'] | 'all')}
            className="pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none"
          >
            <option value="all">All Status</option>
            <option value="inquiry">Inquiry</option>
            <option value="in-progress">In Progress</option>
            <option value="documented">Documented</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan List */}
        <div className="lg:col-span-1 space-y-3">
          {filteredPlans.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <Shield className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">No estate plans found</p>
              <button
                onClick={handleAddPlan}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
              >
                Add your first plan
              </button>
            </div>
          ) : (
            filteredPlans.map(plan => {
              const progress = getChecklistProgress(plan);
              const isSelected = selectedPlan?.id === plan.id;
              const hasChurchGift = plan.churchInWill || plan.churchInTrust || plan.lifeInsuranceChurchBeneficiary || plan.retirementChurchBeneficiary;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full text-left bg-white dark:bg-gray-800 rounded-xl p-4 border transition-all ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{plan.personName}</h3>
                      {plan.spouseName && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">& {plan.spouseName}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[plan.status].bg} ${statusColors[plan.status].text}`}>
                      {statusColors[plan.status].label}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-4">
                      {plan.hasWill && (
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <FileText className="w-3.5 h-3.5" /> Will
                        </span>
                      )}
                      {plan.hasTrust && (
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <Building className="w-3.5 h-3.5" /> Trust
                        </span>
                      )}
                    </div>
                    {hasChurchGift && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Heart className="w-3.5 h-3.5" />
                        <span>Church Legacy Gift</span>
                      </div>
                    )}
                    {plan.plannedGiftAmount && (
                      <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>{formatCurrency(plan.plannedGiftAmount)}</span>
                      </div>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500 dark:text-gray-400">Checklist</span>
                      <span className="text-gray-500 dark:text-gray-400">{progress.completed}/{progress.total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Plan Details */}
        <div className="lg:col-span-2">
          {selectedPlan ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Detail Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPlan.personName}</h2>
                    {selectedPlan.spouseName && (
                      <p className="text-gray-600 dark:text-gray-400">& {selectedPlan.spouseName}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {selectedPlan.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {selectedPlan.phone}
                        </span>
                      )}
                      {selectedPlan.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" /> {selectedPlan.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${statusColors[selectedPlan.status].bg} ${statusColors[selectedPlan.status].text}`}>
                      {statusColors[selectedPlan.status].label}
                    </span>
                    <button
                      onClick={() => handleEditPlan(selectedPlan)}
                      className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Detail Content */}
              <div className="p-6 space-y-6 max-h-[calc(100vh-400px)] overflow-y-auto">
                {/* Estate Documents Section */}
                <div>
                  <button
                    onClick={() => toggleSection('documents')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Estate Documents
                    </h3>
                    {expandedSections.documents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.documents && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-3 rounded-lg ${selectedPlan.hasWill ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          {selectedPlan.hasWill ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={`font-medium ${selectedPlan.hasWill ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            Will
                          </span>
                        </div>
                        {selectedPlan.willDate && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                            Dated: {new Date(selectedPlan.willDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className={`p-3 rounded-lg ${selectedPlan.hasTrust ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          {selectedPlan.hasTrust ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={`font-medium ${selectedPlan.hasTrust ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            Trust
                          </span>
                        </div>
                        {selectedPlan.trustType && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6 capitalize">
                            {selectedPlan.trustType}
                          </p>
                        )}
                      </div>
                      <div className={`p-3 rounded-lg ${selectedPlan.hasPowerOfAttorney ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          {selectedPlan.hasPowerOfAttorney ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={`font-medium ${selectedPlan.hasPowerOfAttorney ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            Power of Attorney
                          </span>
                        </div>
                        {selectedPlan.poaAgent && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                            Agent: {selectedPlan.poaAgent}
                          </p>
                        )}
                      </div>
                      <div className={`p-3 rounded-lg ${selectedPlan.hasHealthcareDirective ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          {selectedPlan.hasHealthcareDirective ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={`font-medium ${selectedPlan.hasHealthcareDirective ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            Healthcare Directive
                          </span>
                        </div>
                        {selectedPlan.healthcareAgent && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                            Agent: {selectedPlan.healthcareAgent}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Legacy Giving Section */}
                <div>
                  <button
                    onClick={() => toggleSection('legacy')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      Legacy Giving
                    </h3>
                    {expandedSections.legacy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.legacy && (
                    <div className="space-y-4">
                      {(selectedPlan.churchInWill || selectedPlan.churchInTrust) ? (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-medium text-emerald-700 dark:text-emerald-300">Church included in estate plan</span>
                          </div>
                          {selectedPlan.plannedGiftType && (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400">
                              Type: {plannedGiftTypes[selectedPlan.plannedGiftType]}
                            </p>
                          )}
                          {selectedPlan.plannedGiftAmount && (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400">
                              Estimated Amount: {formatCurrency(selectedPlan.plannedGiftAmount)}
                            </p>
                          )}
                          {selectedPlan.plannedGiftPercentage && (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400">
                              Percentage: {selectedPlan.plannedGiftPercentage}%
                            </p>
                          )}
                          {selectedPlan.designatedFund && (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400">
                              Designated Fund: {selectedPlan.designatedFund}
                            </p>
                          )}
                          {selectedPlan.giftPurpose && (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
                              Purpose: {selectedPlan.giftPurpose}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm">Church not yet included in estate plan</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Life Insurance & Retirement */}
                <div>
                  <button
                    onClick={() => toggleSection('insurance')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Insurance & Retirement
                    </h3>
                    {expandedSections.insurance ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.insurance && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-3 rounded-lg ${selectedPlan.hasLifeInsurance ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          {selectedPlan.hasLifeInsurance ? (
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={`font-medium ${selectedPlan.hasLifeInsurance ? 'text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            Life Insurance
                          </span>
                        </div>
                        {selectedPlan.lifeInsuranceChurchBeneficiary && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 ml-6">
                            Church is beneficiary
                          </p>
                        )}
                        {selectedPlan.lifeInsuranceAmount && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                            Amount: {formatCurrency(selectedPlan.lifeInsuranceAmount)}
                          </p>
                        )}
                      </div>
                      <div className={`p-3 rounded-lg ${selectedPlan.hasRetirementAccounts ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          {selectedPlan.hasRetirementAccounts ? (
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={`font-medium ${selectedPlan.hasRetirementAccounts ? 'text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            Retirement Accounts
                          </span>
                        </div>
                        {selectedPlan.retirementChurchBeneficiary && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 ml-6">
                            Church is beneficiary
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Checklist Section */}
                <div>
                  <button
                    onClick={() => toggleSection('checklist')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Planning Checklist
                    </h3>
                    {expandedSections.checklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.checklist && (
                    <div className="space-y-4">
                      {(['documents', 'beneficiaries', 'education', 'follow-up'] as const).map(category => {
                        const items = selectedPlan.checklist.filter(item => item.category === category);
                        if (items.length === 0) return null;
                        const completed = items.filter(i => i.completed).length;
                        return (
                          <div key={category}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                                {category === 'follow-up' ? 'Follow-up' : category}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{completed}/{items.length}</span>
                            </div>
                            <div className="space-y-1">
                              {items.map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => handleToggleChecklistItem(selectedPlan.id, item.id)}
                                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                >
                                  {item.completed ? (
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                                  )}
                                  <span className={`text-sm ${item.completed ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {item.task}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Notes Section */}
                <div>
                  <button
                    onClick={() => toggleSection('notes')}
                    className="flex items-center justify-between w-full text-left mb-3"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Notes
                    </h3>
                    {expandedSections.notes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedSections.notes && (
                    <div className="space-y-3">
                      {selectedPlan.notes ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedPlan.notes}</p>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No notes added</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Shield className="w-16 h-16 mx-auto text-gray-200 dark:text-gray-700 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Plan Selected</h3>
              <p className="text-gray-500 dark:text-gray-400">Select a plan from the list to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Estate Plan Form Modal */}
      {showForm && (
        <EstatePlanFormModal
          plan={editingPlan}
          people={_people}
          onSave={handleSavePlan}
          onClose={() => {
            setShowForm(false);
            setEditingPlan(null);
          }}
        />
      )}
    </div>
  );
}

// Estate Plan Form Modal Component
function EstatePlanFormModal({
  plan,
  people: _people,
  onSave,
  onClose,
}: {
  plan: EstatePlan | null;
  people: Person[];
  onSave: (data: Partial<EstatePlan>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    personName: plan?.personName || '',
    spouseName: plan?.spouseName || '',
    email: plan?.email || '',
    phone: plan?.phone || '',
    hasWill: plan?.hasWill || false,
    willDate: plan?.willDate || '',
    hasTrust: plan?.hasTrust || false,
    trustType: plan?.trustType || '',
    hasPowerOfAttorney: plan?.hasPowerOfAttorney || false,
    poaAgent: plan?.poaAgent || '',
    hasHealthcareDirective: plan?.hasHealthcareDirective || false,
    healthcareAgent: plan?.healthcareAgent || '',
    churchInWill: plan?.churchInWill || false,
    churchInTrust: plan?.churchInTrust || false,
    plannedGiftType: plan?.plannedGiftType || '',
    plannedGiftAmount: plan?.plannedGiftAmount?.toString() || '',
    plannedGiftPercentage: plan?.plannedGiftPercentage?.toString() || '',
    designatedFund: plan?.designatedFund || '',
    giftPurpose: plan?.giftPurpose || '',
    hasLifeInsurance: plan?.hasLifeInsurance || false,
    lifeInsuranceChurchBeneficiary: plan?.lifeInsuranceChurchBeneficiary || false,
    lifeInsuranceAmount: plan?.lifeInsuranceAmount?.toString() || '',
    hasRetirementAccounts: plan?.hasRetirementAccounts || false,
    retirementChurchBeneficiary: plan?.retirementChurchBeneficiary || false,
    status: plan?.status || 'inquiry',
    notes: plan?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      trustType: formData.trustType as EstatePlan['trustType'] || undefined,
      plannedGiftType: formData.plannedGiftType as EstatePlan['plannedGiftType'] || undefined,
      plannedGiftAmount: formData.plannedGiftAmount ? parseFloat(formData.plannedGiftAmount) : undefined,
      plannedGiftPercentage: formData.plannedGiftPercentage ? parseFloat(formData.plannedGiftPercentage) : undefined,
      lifeInsuranceAmount: formData.lifeInsuranceAmount ? parseFloat(formData.lifeInsuranceAmount) : undefined,
      status: formData.status as EstatePlan['status'],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {plan ? 'Edit Estate Plan' : 'New Estate Plan'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.personName}
                  onChange={(e) => setFormData(prev => ({ ...prev, personName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Spouse Name</label>
                <input
                  type="text"
                  value={formData.spouseName}
                  onChange={(e) => setFormData(prev => ({ ...prev, spouseName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Estate Documents */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Estate Documents</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasWill}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasWill: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Has Will</span>
                </label>
                {formData.hasWill && (
                  <div className="ml-6">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Will Date</label>
                    <input
                      type="date"
                      value={formData.willDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, willDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasTrust}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasTrust: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Has Trust</span>
                </label>
                {formData.hasTrust && (
                  <div className="ml-6">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Trust Type</label>
                    <select
                      value={formData.trustType}
                      onChange={(e) => setFormData(prev => ({ ...prev, trustType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">Select type...</option>
                      <option value="revocable">Revocable Living Trust</option>
                      <option value="irrevocable">Irrevocable Trust</option>
                      <option value="charitable">Charitable Trust</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasPowerOfAttorney}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasPowerOfAttorney: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Power of Attorney</span>
                </label>
                {formData.hasPowerOfAttorney && (
                  <div className="ml-6">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Agent Name</label>
                    <input
                      type="text"
                      value={formData.poaAgent}
                      onChange={(e) => setFormData(prev => ({ ...prev, poaAgent: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasHealthcareDirective}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasHealthcareDirective: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Healthcare Directive</span>
                </label>
                {formData.hasHealthcareDirective && (
                  <div className="ml-6">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Healthcare Agent</label>
                    <input
                      type="text"
                      value={formData.healthcareAgent}
                      onChange={(e) => setFormData(prev => ({ ...prev, healthcareAgent: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Legacy Giving */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Legacy Giving to Church</h3>
            <div className="space-y-4">
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.churchInWill}
                    onChange={(e) => setFormData(prev => ({ ...prev, churchInWill: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Church in Will</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.churchInTrust}
                    onChange={(e) => setFormData(prev => ({ ...prev, churchInTrust: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Church in Trust</span>
                </label>
              </div>
              {(formData.churchInWill || formData.churchInTrust) && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Gift Type</label>
                    <select
                      value={formData.plannedGiftType}
                      onChange={(e) => setFormData(prev => ({ ...prev, plannedGiftType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">Select type...</option>
                      {Object.entries(plannedGiftTypes).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Designated Fund</label>
                    <select
                      value={formData.designatedFund}
                      onChange={(e) => setFormData(prev => ({ ...prev, designatedFund: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">Select fund...</option>
                      {fundOptions.map(fund => (
                        <option key={fund} value={fund}>{fund}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Estimated Amount ($)</label>
                    <input
                      type="number"
                      value={formData.plannedGiftAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, plannedGiftAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Percentage (%)</label>
                    <input
                      type="number"
                      value={formData.plannedGiftPercentage}
                      onChange={(e) => setFormData(prev => ({ ...prev, plannedGiftPercentage: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="0"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Gift Purpose / Intention</label>
                    <input
                      type="text"
                      value={formData.giftPurpose}
                      onChange={(e) => setFormData(prev => ({ ...prev, giftPurpose: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="e.g., To support youth ministry"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Insurance & Retirement */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Life Insurance & Retirement</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasLifeInsurance}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasLifeInsurance: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Has Life Insurance</span>
                </label>
                {formData.hasLifeInsurance && (
                  <div className="ml-6 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.lifeInsuranceChurchBeneficiary}
                        onChange={(e) => setFormData(prev => ({ ...prev, lifeInsuranceChurchBeneficiary: e.target.checked }))}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Church is Beneficiary</span>
                    </label>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Amount</label>
                      <input
                        type="number"
                        value={formData.lifeInsuranceAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, lifeInsuranceAmount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasRetirementAccounts}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasRetirementAccounts: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Has Retirement Accounts</span>
                </label>
                {formData.hasRetirementAccounts && (
                  <div className="ml-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.retirementChurchBeneficiary}
                        onChange={(e) => setFormData(prev => ({ ...prev, retirementChurchBeneficiary: e.target.checked }))}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Church is Beneficiary</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as EstatePlan['status'] }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="inquiry">Inquiry</option>
              <option value="in-progress">In Progress</option>
              <option value="documented">Documented</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Additional notes about the estate plan..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {plan ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
