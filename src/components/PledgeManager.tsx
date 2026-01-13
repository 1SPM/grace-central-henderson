import { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  X,
  Edit2,
  Trash2,
  Flag,
} from 'lucide-react';
import type { Person, Campaign, Pledge, PledgeFrequency, PledgeStatus } from '../types';
import { GIVING_FUNDS } from '../lib/services/payments';

interface PledgeManagerProps {
  people: Person[];
  campaigns: Campaign[];
  pledges: Pledge[];
  onCreateCampaign: (campaign: Omit<Campaign, 'id'>) => void;
  onUpdateCampaign: (id: string, updates: Partial<Campaign>) => void;
  onCreatePledge: (pledge: Omit<Pledge, 'id'>) => void;
  onUpdatePledge: (id: string, updates: Partial<Pledge>) => void;
  onDeletePledge: (id: string) => void;
  onBack?: () => void;
}

type TabType = 'campaigns' | 'pledges';

const FREQUENCY_OPTIONS: { id: PledgeFrequency; label: string }[] = [
  { id: 'one-time', label: 'One-time' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annually', label: 'Annually' },
];

export function PledgeManager({
  people,
  campaigns,
  pledges,
  onCreateCampaign,
  onUpdateCampaign,
  onCreatePledge,
  onUpdatePledge,
  onDeletePledge,
  onBack,
}: PledgeManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('campaigns');
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewPledge, setShowNewPledge] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Campaign form
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignGoal, setCampaignGoal] = useState('');
  const [campaignStartDate, setCampaignStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [campaignEndDate, setCampaignEndDate] = useState('');
  const [campaignFund, setCampaignFund] = useState('building');

  // Pledge form
  const [pledgePersonId, setPledgePersonId] = useState('');
  const [pledgeCampaignId, setPledgeCampaignId] = useState('');
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeFrequency, setPledgeFrequency] = useState<PledgeFrequency>('monthly');
  const [pledgeStartDate, setPledgeStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [pledgeEndDate, setPledgeEndDate] = useState('');
  const [pledgeFund, setPledgeFund] = useState('tithe');
  const [pledgeNotes, setPledgeNotes] = useState('');

  // Calculate campaign statistics
  const campaignStats = useMemo(() => {
    return campaigns.map((campaign) => {
      const campaignPledges = pledges.filter((p) => p.campaignId === campaign.id);
      const totalPledged = campaignPledges.reduce((sum, p) => sum + (p.totalPledged || p.amount), 0);
      const totalGiven = campaignPledges.reduce((sum, p) => sum + (p.totalGiven || 0), 0);
      const percentage = campaign.goalAmount ? (totalGiven / campaign.goalAmount) * 100 : 0;

      return {
        ...campaign,
        pledgeCount: campaignPledges.length,
        totalPledged,
        totalGiven,
        percentage: Math.min(percentage, 100),
      };
    });
  }, [campaigns, pledges]);

  // Filter pledges by selected campaign
  const filteredPledges = useMemo(() => {
    if (!selectedCampaignId) return pledges;
    return pledges.filter((p) => p.campaignId === selectedCampaignId);
  }, [pledges, selectedCampaignId]);

  const handleCreateCampaign = () => {
    onCreateCampaign({
      name: campaignName,
      description: campaignDescription || undefined,
      goalAmount: campaignGoal ? parseFloat(campaignGoal) : undefined,
      startDate: campaignStartDate,
      endDate: campaignEndDate || undefined,
      fund: campaignFund,
      isActive: true,
    });
    setShowNewCampaign(false);
    resetCampaignForm();
  };

  const handleCreatePledge = () => {
    onCreatePledge({
      personId: pledgePersonId || undefined,
      campaignId: pledgeCampaignId || undefined,
      amount: parseFloat(pledgeAmount),
      frequency: pledgeFrequency,
      startDate: pledgeStartDate,
      endDate: pledgeEndDate || undefined,
      fund: pledgeFund,
      status: 'active',
      notes: pledgeNotes || undefined,
    });
    setShowNewPledge(false);
    resetPledgeForm();
  };

  const resetCampaignForm = () => {
    setCampaignName('');
    setCampaignDescription('');
    setCampaignGoal('');
    setCampaignStartDate(new Date().toISOString().split('T')[0]);
    setCampaignEndDate('');
    setCampaignFund('building');
  };

  const resetPledgeForm = () => {
    setPledgePersonId('');
    setPledgeCampaignId('');
    setPledgeAmount('');
    setPledgeFrequency('monthly');
    setPledgeStartDate(new Date().toISOString().split('T')[0]);
    setPledgeEndDate('');
    setPledgeFund('tithe');
    setPledgeNotes('');
  };

  const getStatusColor = (status: PledgeStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400';
      case 'completed':
        return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'cancelled':
        return 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
            Pledges & Campaigns
          </h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            Track commitments and fundraising goals
          </p>
        </div>
        <div className="flex gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
            >
              Back to Giving
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            activeTab === 'campaigns'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400 hover:bg-gray-200 dark:hover:bg-dark-700'
          }`}
        >
          <Target className="inline-block mr-2" size={18} />
          Campaigns
        </button>
        <button
          onClick={() => setActiveTab('pledges')}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            activeTab === 'pledges'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400 hover:bg-gray-200 dark:hover:bg-dark-700'
          }`}
        >
          <Flag className="inline-block mr-2" size={18} />
          Pledges
        </button>
      </div>

      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Campaign Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Target className="text-purple-600 dark:text-purple-400" size={20} />
                </div>
                <span className="text-sm text-gray-500 dark:text-dark-400">Active Campaigns</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
                {campaigns.filter((c) => c.isActive).length}
              </p>
            </div>
            <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="text-green-600 dark:text-green-400" size={20} />
                </div>
                <span className="text-sm text-gray-500 dark:text-dark-400">Total Pledged</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
                ${pledges.reduce((sum, p) => sum + (p.totalPledged || p.amount), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="text-blue-600 dark:text-blue-400" size={20} />
                </div>
                <span className="text-sm text-gray-500 dark:text-dark-400">Total Received</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
                ${pledges.reduce((sum, p) => sum + (p.totalGiven || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <Users className="text-amber-600 dark:text-amber-400" size={20} />
                </div>
                <span className="text-sm text-gray-500 dark:text-dark-400">Active Pledges</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">
                {pledges.filter((p) => p.status === 'active').length}
              </p>
            </div>
          </div>

          {/* Campaigns List */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Fundraising Campaigns
              </h2>
              <button
                onClick={() => setShowNewCampaign(true)}
                className="px-4 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                New Campaign
              </button>
            </div>

            {campaignStats.length === 0 ? (
              <div className="text-center py-12">
                <Target className="mx-auto text-gray-300 dark:text-dark-600 mb-4" size={48} />
                <p className="text-gray-500 dark:text-dark-400">
                  No campaigns yet. Create your first fundraising campaign.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {campaignStats.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="p-4 bg-gray-50 dark:bg-dark-800 rounded-xl"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-dark-100">
                          {campaign.name}
                        </h3>
                        {campaign.description && (
                          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                            {campaign.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            campaign.isActive
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {campaign.isActive ? 'Active' : 'Ended'}
                        </span>
                        <button
                          onClick={() => onUpdateCampaign(campaign.id, { isActive: !campaign.isActive })}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {campaign.goalAmount && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-500 dark:text-dark-400">
                            ${campaign.totalGiven.toLocaleString()} of ${campaign.goalAmount.toLocaleString()}
                          </span>
                          <span className="font-medium text-purple-600 dark:text-purple-400">
                            {campaign.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${campaign.percentage}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4 text-gray-500 dark:text-dark-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(campaign.startDate).toLocaleDateString()}
                          {campaign.endDate && ` - ${new Date(campaign.endDate).toLocaleDateString()}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {campaign.pledgeCount} pledges
                        </span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-dark-100 capitalize">
                        {campaign.fund}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pledges' && (
        <div className="space-y-6">
          {/* Filter by Campaign */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <select
                value={selectedCampaignId || ''}
                onChange={(e) => setSelectedCampaignId(e.target.value || null)}
                className="w-full max-w-xs px-4 py-2 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
              >
                <option value="">All Pledges</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowNewPledge(true)}
              className="px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              New Pledge
            </button>
          </div>

          {/* Pledges List */}
          <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            {filteredPledges.length === 0 ? (
              <div className="text-center py-12">
                <Flag className="mx-auto text-gray-300 dark:text-dark-600 mb-4" size={48} />
                <p className="text-gray-500 dark:text-dark-400">
                  No pledges found. Create one to start tracking commitments.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                      Donor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                      Campaign/Fund
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-dark-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {filteredPledges.map((pledge) => {
                    const person = people.find((p) => p.id === pledge.personId);
                    const campaign = campaigns.find((c) => c.id === pledge.campaignId);
                    const percentComplete = pledge.percentComplete || 0;

                    return (
                      <tr key={pledge.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {person ? (
                              <>
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                  {person.firstName[0]}{person.lastName[0]}
                                </div>
                                <span className="font-medium text-gray-900 dark:text-dark-100">
                                  {person.firstName} {person.lastName}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-500 dark:text-dark-400">Anonymous</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            {campaign && (
                              <p className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                                {campaign.name}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-dark-400 capitalize">
                              {pledge.fund}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-dark-100">
                              ${pledge.amount.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-dark-400 capitalize">
                              {pledge.frequency}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-32">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-500 dark:text-dark-400">
                                ${(pledge.totalGiven || 0).toLocaleString()}
                              </span>
                              <span className="font-medium">{percentComplete.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percentComplete >= 100
                                    ? 'bg-green-500'
                                    : percentComplete >= 50
                                    ? 'bg-blue-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(percentComplete, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(pledge.status)}`}>
                            {pledge.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {pledge.status === 'active' && (
                              <button
                                onClick={() => onUpdatePledge(pledge.id, { status: 'completed' })}
                                className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg"
                                title="Mark as completed"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => onDeletePledge(pledge.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                              title="Delete pledge"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* New Campaign Modal */}
      {showNewCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Create Campaign
              </h3>
              <button
                onClick={() => {
                  setShowNewCampaign(false);
                  resetCampaignForm();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Building Fund 2025"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Description
                </label>
                <textarea
                  value={campaignDescription}
                  onChange={(e) => setCampaignDescription(e.target.value)}
                  placeholder="Describe the purpose of this campaign..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Goal Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="number"
                    value={campaignGoal}
                    onChange={(e) => setCampaignGoal(e.target.value)}
                    placeholder="50000"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={campaignStartDate}
                    onChange={(e) => setCampaignStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={campaignEndDate}
                    onChange={(e) => setCampaignEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Fund
                </label>
                <select
                  value={campaignFund}
                  onChange={(e) => setCampaignFund(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  {GIVING_FUNDS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewCampaign(false);
                  resetCampaignForm();
                }}
                className="flex-1 py-3 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={!campaignName || !campaignStartDate}
                className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Pledge Modal */}
      {showNewPledge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Create Pledge
              </h3>
              <button
                onClick={() => {
                  setShowNewPledge(false);
                  resetPledgeForm();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Donor
                </label>
                <select
                  value={pledgePersonId}
                  onChange={(e) => setPledgePersonId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="">Select a person (optional)</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Campaign
                </label>
                <select
                  value={pledgeCampaignId}
                  onChange={(e) => setPledgeCampaignId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="">No campaign (general pledge)</option>
                  {campaigns.filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Amount *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="number"
                      value={pledgeAmount}
                      onChange={(e) => setPledgeAmount(e.target.value)}
                      placeholder="100"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={pledgeFrequency}
                    onChange={(e) => setPledgeFrequency(e.target.value as PledgeFrequency)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  >
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={pledgeStartDate}
                    onChange={(e) => setPledgeStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={pledgeEndDate}
                    onChange={(e) => setPledgeEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Fund
                </label>
                <select
                  value={pledgeFund}
                  onChange={(e) => setPledgeFund(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  {GIVING_FUNDS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={pledgeNotes}
                  onChange={(e) => setPledgeNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewPledge(false);
                  resetPledgeForm();
                }}
                className="flex-1 py-3 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePledge}
                disabled={!pledgeAmount || !pledgeStartDate}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Pledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
