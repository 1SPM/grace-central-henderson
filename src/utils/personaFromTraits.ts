/**
 * Generate AI persona configuration from personality traits and leader profile data.
 */

const TRAIT_DESCRIPTORS: Record<string, string> = {
  'Warm': 'warm and welcoming',
  'Patient': 'patient and unhurried',
  'Curious': 'genuinely curious',
  'Empathetic': 'deeply empathetic',
  'Comforting': 'comforting and reassuring',
  'Coaching': 'coaching-oriented',
  'Direct': 'direct and honest',
  'Gentle': 'gentle in approach',
  'Humorous': 'with a touch of humor',
  'Scholarly': 'scholarly and well-read',
  'Nurturing': 'nurturing and caring',
  'Encouraging': 'encouraging and uplifting',
  'Faith-driven': 'deeply rooted in faith',
  'Scripture-focused': 'drawing frequently from Scripture',
  'Practical': 'practical and action-oriented',
  'Contemplative': 'contemplative and reflective',
};

export const AVAILABLE_TRAITS = Object.keys(TRAIT_DESCRIPTORS);

export const SPIRITUAL_FOCUS_OPTIONS = [
  'Prayer Ministry',
  'Mindfulness',
  'Deliverance',
  'Worship',
  'Bible Study',
  'Missions',
  'Discipleship',
  'Prophetic Ministry',
  'Healing Ministry',
  'Intercessory Prayer',
];

export const SUITABLE_FOR_OPTIONS = [
  'Adults',
  'Youth',
  'Couples',
  'Families',
  'Seniors',
  'Men',
  'Women',
  'New Believers',
];

/**
 * Generate a personality description from selected traits.
 * Example: ["Warm", "Patient", "Scripture-focused"] =>
 *   "Warm and welcoming, patient and unhurried, drawing frequently from Scripture"
 */
export function generatePersonalityDescription(traits: string[]): string {
  if (traits.length === 0) return 'Supportive and caring';

  const descriptors = traits
    .map(t => TRAIT_DESCRIPTORS[t])
    .filter(Boolean);

  if (descriptors.length === 0) return traits.join(', ');
  if (descriptors.length === 1) return capitalizeFirst(descriptors[0]);
  if (descriptors.length === 2) return `${capitalizeFirst(descriptors[0])} and ${descriptors[1]}`;

  const last = descriptors.pop();
  return `${capitalizeFirst(descriptors.join(', '))}, and ${last}`;
}

/**
 * Generate a system prompt preamble from leader profile data.
 */
export function generateSystemPrompt(leader: {
  displayName: string;
  personalityTraits: string[];
  expertiseAreas: string[];
  anchors?: string;
  language?: string;
}): string {
  const personality = generatePersonalityDescription(leader.personalityTraits);
  const expertise = leader.expertiseAreas.length > 0
    ? `You specialize in: ${leader.expertiseAreas.join(', ')}.`
    : '';

  const anchor = leader.anchors
    ? `\nYour guiding scripture: "${leader.anchors}"`
    : '';

  const langNote = leader.language && leader.language !== 'English'
    ? `\nRespond in ${leader.language} when appropriate.`
    : '';

  return `You are ${leader.displayName}'s AI pastoral care assistant. Your personality is ${personality.toLowerCase()}. ${expertise}${anchor}${langNote}

Always maintain confidentiality. If someone expresses suicidal thoughts or immediate danger, provide crisis resources (988 Lifeline, 911) and escalate to the human leader immediately. You are here to provide compassionate initial support, not to replace professional counseling.`.trim();
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
