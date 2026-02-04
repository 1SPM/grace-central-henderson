import { useState, useMemo } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  X,
  ChevronRight,
  Star,
  Award,
  Users,
  Filter,
  Edit2,
  Trash2,
  Music,
  Camera,
  Monitor,
  Wrench,
  Heart,
  BookOpen,
  Coffee,
  Baby,
  Car,
  Languages,
} from 'lucide-react';
import { Person } from '../types';

interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  icon?: string;
}

type SkillCategory =
  | 'music'
  | 'technical'
  | 'creative'
  | 'hospitality'
  | 'teaching'
  | 'childcare'
  | 'administration'
  | 'maintenance'
  | 'transportation'
  | 'languages'
  | 'other';

interface PersonSkill {
  skillId: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsExperience?: number;
  notes?: string;
  willingToServe: boolean;
}

interface SkillsDatabaseProps {
  people: Person[];
  onViewPerson: (id: string) => void;
  onUpdatePersonSkills?: (personId: string, skills: PersonSkill[]) => Promise<void>;
}

const CATEGORY_CONFIG: Record<SkillCategory, { label: string; icon: React.ElementType; color: string }> = {
  music: { label: 'Music & Worship', icon: Music, color: 'purple' },
  technical: { label: 'Technical & AV', icon: Monitor, color: 'blue' },
  creative: { label: 'Creative & Media', icon: Camera, color: 'pink' },
  hospitality: { label: 'Hospitality', icon: Coffee, color: 'amber' },
  teaching: { label: 'Teaching & Education', icon: BookOpen, color: 'green' },
  childcare: { label: 'Childcare & Youth', icon: Baby, color: 'orange' },
  administration: { label: 'Administration', icon: Briefcase, color: 'slate' },
  maintenance: { label: 'Maintenance & Facilities', icon: Wrench, color: 'gray' },
  transportation: { label: 'Transportation', icon: Car, color: 'indigo' },
  languages: { label: 'Languages', icon: Languages, color: 'teal' },
  other: { label: 'Other', icon: Star, color: 'gray' },
};

const DEFAULT_SKILLS: Skill[] = [
  // Music
  { id: 'vocals', name: 'Vocals / Singing', category: 'music' },
  { id: 'piano', name: 'Piano / Keyboard', category: 'music' },
  { id: 'guitar', name: 'Guitar', category: 'music' },
  { id: 'drums', name: 'Drums / Percussion', category: 'music' },
  { id: 'bass', name: 'Bass Guitar', category: 'music' },
  { id: 'strings', name: 'Strings (Violin, Cello)', category: 'music' },
  { id: 'worship-leading', name: 'Worship Leading', category: 'music' },

  // Technical
  { id: 'sound-mixing', name: 'Sound Mixing / Audio', category: 'technical' },
  { id: 'lighting', name: 'Lighting', category: 'technical' },
  { id: 'video-production', name: 'Video Production', category: 'technical' },
  { id: 'live-streaming', name: 'Live Streaming', category: 'technical' },
  { id: 'projection', name: 'Projection / Slides', category: 'technical' },
  { id: 'it-support', name: 'IT / Computer Support', category: 'technical' },

  // Creative
  { id: 'photography', name: 'Photography', category: 'creative' },
  { id: 'graphic-design', name: 'Graphic Design', category: 'creative' },
  { id: 'social-media', name: 'Social Media', category: 'creative' },
  { id: 'writing', name: 'Writing / Content Creation', category: 'creative' },
  { id: 'drama', name: 'Drama / Acting', category: 'creative' },

  // Hospitality
  { id: 'greeting', name: 'Greeting / Welcome', category: 'hospitality' },
  { id: 'ushering', name: 'Ushering', category: 'hospitality' },
  { id: 'food-prep', name: 'Food Preparation', category: 'hospitality' },
  { id: 'event-planning', name: 'Event Planning', category: 'hospitality' },
  { id: 'decorating', name: 'Decorating', category: 'hospitality' },

  // Teaching
  { id: 'sunday-school', name: 'Sunday School Teaching', category: 'teaching' },
  { id: 'bible-study', name: 'Bible Study Leading', category: 'teaching' },
  { id: 'mentoring', name: 'Mentoring', category: 'teaching' },
  { id: 'counseling', name: 'Counseling', category: 'teaching' },

  // Childcare
  { id: 'nursery', name: 'Nursery Care', category: 'childcare' },
  { id: 'childrens-church', name: "Children's Church", category: 'childcare' },
  { id: 'youth-ministry', name: 'Youth Ministry', category: 'childcare' },
  { id: 'vbs', name: 'VBS / Camp', category: 'childcare' },

  // Administration
  { id: 'accounting', name: 'Accounting / Finance', category: 'administration' },
  { id: 'data-entry', name: 'Data Entry', category: 'administration' },
  { id: 'scheduling', name: 'Scheduling', category: 'administration' },
  { id: 'communications', name: 'Communications', category: 'administration' },

  // Maintenance
  { id: 'carpentry', name: 'Carpentry', category: 'maintenance' },
  { id: 'electrical', name: 'Electrical', category: 'maintenance' },
  { id: 'plumbing', name: 'Plumbing', category: 'maintenance' },
  { id: 'grounds', name: 'Grounds / Landscaping', category: 'maintenance' },
  { id: 'cleaning', name: 'Cleaning', category: 'maintenance' },

  // Transportation
  { id: 'driving', name: 'Driving', category: 'transportation' },
  { id: 'bus-driver', name: 'Bus Driver (CDL)', category: 'transportation' },

  // Languages
  { id: 'spanish', name: 'Spanish', category: 'languages' },
  { id: 'french', name: 'French', category: 'languages' },
  { id: 'sign-language', name: 'Sign Language', category: 'languages' },
];

const LEVEL_CONFIG = {
  beginner: { label: 'Beginner', color: 'gray', stars: 1 },
  intermediate: { label: 'Intermediate', color: 'blue', stars: 2 },
  advanced: { label: 'Advanced', color: 'purple', stars: 3 },
  expert: { label: 'Expert', color: 'amber', stars: 4 },
};

// Mock data for skills - in production, this would come from the database
const getPersonSkills = (personId: string): PersonSkill[] => {
  const stored = localStorage.getItem(`skills-${personId}`);
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
};

const savePersonSkills = (personId: string, skills: PersonSkill[]) => {
  localStorage.setItem(`skills-${personId}`, JSON.stringify(skills));
};

export function SkillsDatabase({ people, onViewPerson }: SkillsDatabaseProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [personSkills, setPersonSkills] = useState<Record<string, PersonSkill[]>>(() => {
    const initial: Record<string, PersonSkill[]> = {};
    people.forEach(p => {
      initial[p.id] = getPersonSkills(p.id);
    });
    return initial;
  });

  // Get all people with a specific skill
  const peopleWithSkill = useMemo(() => {
    if (!selectedSkill) return [];

    return people.filter(person => {
      const skills = personSkills[person.id] || [];
      return skills.some(s => s.skillId === selectedSkill);
    }).map(person => {
      const skill = (personSkills[person.id] || []).find(s => s.skillId === selectedSkill);
      return { person, skill };
    });
  }, [selectedSkill, people, personSkills]);

  // Get skill statistics
  const skillStats = useMemo(() => {
    const stats: Record<string, { total: number; willing: number }> = {};

    Object.values(personSkills).forEach(skills => {
      skills.forEach(skill => {
        if (!stats[skill.skillId]) {
          stats[skill.skillId] = { total: 0, willing: 0 };
        }
        stats[skill.skillId].total++;
        if (skill.willingToServe) {
          stats[skill.skillId].willing++;
        }
      });
    });

    return stats;
  }, [personSkills]);

  // Filter skills by category
  const filteredSkills = useMemo(() => {
    let skills = DEFAULT_SKILLS;

    if (selectedCategory !== 'all') {
      skills = skills.filter(s => s.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      skills = skills.filter(s => s.name.toLowerCase().includes(query));
    }

    return skills;
  }, [selectedCategory, searchQuery]);

  // Handle adding/updating skill for a person
  const handleUpdatePersonSkill = (personId: string, skill: PersonSkill) => {
    const updatedSkills = [...(personSkills[personId] || [])];
    const existingIndex = updatedSkills.findIndex(s => s.skillId === skill.skillId);

    if (existingIndex >= 0) {
      updatedSkills[existingIndex] = skill;
    } else {
      updatedSkills.push(skill);
    }

    setPersonSkills(prev => ({ ...prev, [personId]: updatedSkills }));
    savePersonSkills(personId, updatedSkills);
  };

  const handleRemovePersonSkill = (personId: string, skillId: string) => {
    const updatedSkills = (personSkills[personId] || []).filter(s => s.skillId !== skillId);
    setPersonSkills(prev => ({ ...prev, [personId]: updatedSkills }));
    savePersonSkills(personId, updatedSkills);
  };

  const getCategoryIcon = (category: SkillCategory) => {
    const Icon = CATEGORY_CONFIG[category].icon;
    return Icon;
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Skills & Talents</h1>
            <p className="text-gray-500 dark:text-dark-400 mt-1">
              Track member abilities for ministry and volunteer matching
            </p>
          </div>
          <button
            onClick={() => alert('Custom skill creation coming soon!')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            Add Custom Skill
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - Categories & Skills */}
          <div className="col-span-4 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-gray-900 dark:text-dark-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Category Filter */}
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300 mb-3">Categories</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-dark-400 hover:bg-gray-50 dark:hover:bg-dark-700'
                  }`}
                >
                  <Filter size={16} />
                  <span className="text-sm font-medium">All Categories</span>
                </button>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key as SkillCategory)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        selectedCategory === key
                          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                          : 'text-gray-600 dark:text-dark-400 hover:bg-gray-50 dark:hover:bg-dark-700'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-sm font-medium">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Skills List */}
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-dark-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300">
                  Skills ({filteredSkills.length})
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredSkills.map(skill => {
                  const stats = skillStats[skill.id];
                  const Icon = getCategoryIcon(skill.category);
                  return (
                    <button
                      key={skill.id}
                      onClick={() => setSelectedSkill(skill.id)}
                      className={`w-full flex items-center justify-between p-3 border-b border-gray-100 dark:border-dark-700 last:border-0 hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors ${
                        selectedSkill === skill.id ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 bg-${CATEGORY_CONFIG[skill.category].color}-100 dark:bg-${CATEGORY_CONFIG[skill.category].color}-500/20 rounded-lg flex items-center justify-center`}>
                          <Icon size={16} className={`text-${CATEGORY_CONFIG[skill.category].color}-600 dark:text-${CATEGORY_CONFIG[skill.category].color}-400`} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                          {skill.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {stats && (
                          <span className="text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-400 px-2 py-0.5 rounded-full">
                            {stats.total}
                          </span>
                        )}
                        <ChevronRight size={16} className="text-gray-300 dark:text-dark-600" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content - People with selected skill */}
          <div className="col-span-8">
            {selectedSkill ? (
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
                {/* Skill Header */}
                <div className="p-6 border-b border-gray-200 dark:border-dark-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center">
                        <Award size={24} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100">
                          {DEFAULT_SKILLS.find(s => s.id === selectedSkill)?.name}
                        </h2>
                        <p className="text-gray-500 dark:text-dark-400">
                          {peopleWithSkill.length} {peopleWithSkill.length === 1 ? 'person' : 'people'} with this skill
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedSkill(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                    >
                      <X size={18} className="text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* People List */}
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {peopleWithSkill.length === 0 ? (
                    <div className="p-12 text-center">
                      <Users className="mx-auto text-gray-300 dark:text-dark-600 mb-4" size={48} />
                      <p className="text-gray-500 dark:text-dark-400">No one has this skill yet</p>
                      <p className="text-sm text-gray-400 dark:text-dark-500 mt-1">
                        Add skills to people from their profile
                      </p>
                    </div>
                  ) : (
                    peopleWithSkill.map(({ person, skill }) => (
                      <div
                        key={person.id}
                        className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-850 transition-colors"
                      >
                        <button
                          onClick={() => onViewPerson(person.id)}
                          className="flex items-center gap-4 text-left"
                        >
                          {person.photo ? (
                            <img
                              src={person.photo}
                              alt={`${person.firstName} ${person.lastName}`}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 dark:bg-dark-700 rounded-full flex items-center justify-center text-gray-500 dark:text-dark-400 font-medium text-lg">
                              {person.firstName[0]}{person.lastName[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-dark-100">
                              {person.firstName} {person.lastName}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              {skill && (
                                <>
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: LEVEL_CONFIG[skill.level].stars }).map((_, i) => (
                                      <Star
                                        key={i}
                                        size={12}
                                        className={`fill-${LEVEL_CONFIG[skill.level].color}-400 text-${LEVEL_CONFIG[skill.level].color}-400`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs text-gray-500 dark:text-dark-400">
                                    {LEVEL_CONFIG[skill.level].label}
                                  </span>
                                  {skill.willingToServe && (
                                    <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Heart size={10} />
                                      Willing to serve
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingPerson(person.id)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleRemovePersonSkill(person.id, selectedSkill)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-12 text-center">
                <Award size={64} className="mx-auto text-gray-300 dark:text-dark-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-2">
                  Select a skill
                </h3>
                <p className="text-gray-500 dark:text-dark-400">
                  Choose a skill from the list to see who has that ability
                </p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
                    <Users size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                      {people.filter(p => (personSkills[p.id] || []).length > 0).length}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-dark-400">People with skills</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Heart size={20} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                      {Object.values(skillStats).reduce((acc, s) => acc + s.willing, 0)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Willing volunteers</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Award size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                      {Object.keys(skillStats).length}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Skills tracked</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Person Skill Modal */}
      {editingPerson && selectedSkill && (
        <EditSkillModal
          person={people.find(p => p.id === editingPerson)!}
          skill={DEFAULT_SKILLS.find(s => s.id === selectedSkill)!}
          currentSkill={(personSkills[editingPerson] || []).find(s => s.skillId === selectedSkill)}
          onSave={(skill) => {
            handleUpdatePersonSkill(editingPerson, skill);
            setEditingPerson(null);
          }}
          onClose={() => setEditingPerson(null)}
        />
      )}
    </div>
  );
}

// Modal for editing a person's skill
function EditSkillModal({
  person,
  skill,
  currentSkill,
  onSave,
  onClose,
}: {
  person: Person;
  skill: Skill;
  currentSkill?: PersonSkill;
  onSave: (skill: PersonSkill) => void;
  onClose: () => void;
}) {
  const [level, setLevel] = useState<PersonSkill['level']>(currentSkill?.level || 'intermediate');
  const [yearsExperience, setYearsExperience] = useState(currentSkill?.yearsExperience?.toString() || '');
  const [notes, setNotes] = useState(currentSkill?.notes || '');
  const [willingToServe, setWillingToServe] = useState(currentSkill?.willingToServe ?? true);

  const handleSave = () => {
    onSave({
      skillId: skill.id,
      level,
      yearsExperience: yearsExperience ? parseInt(yearsExperience) : undefined,
      notes: notes || undefined,
      willingToServe,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Edit Skill
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                {person.firstName} {person.lastName} - {skill.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Skill Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
              Skill Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(LEVEL_CONFIG) as [PersonSkill['level'], typeof LEVEL_CONFIG.beginner][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setLevel(key)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                      level === key
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                    }`}
                  >
                    <div className="flex">
                      {Array.from({ length: config.stars }).map((_, i) => (
                        <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
                      {config.label}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Years Experience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Years of Experience
            </label>
            <input
              type="number"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              placeholder="Optional"
              min="0"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Willing to Serve */}
          <label className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={willingToServe}
              onChange={(e) => setWillingToServe(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-dark-100">Willing to serve</p>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                Available to volunteer in this area
              </p>
            </div>
            <Heart className="text-green-500" size={20} />
          </label>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
