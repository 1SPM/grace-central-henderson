import { useState, useCallback } from 'react';
import type {
  LeaderProfile,
  HelpRequest,
  PastoralConversation,
  PastoralMessage,
  HelpCategory,
  ConversationPriority,
} from '../types';

// Demo leader profiles
const INITIAL_LEADERS: LeaderProfile[] = [
  {
    id: 'leader-1',
    personId: 'person-1',
    displayName: 'Pastor Mike Davis',
    title: 'Senior Pastor — Marriage & Family',
    bio: 'Over 20 years of pastoral experience specializing in marriage counseling and family restoration. Certified by the American Association of Christian Counselors.',
    photo: undefined,
    expertiseAreas: ['marriage', 'parenting', 'general'],
    isAvailable: true,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'leader-2',
    personId: 'person-2',
    displayName: 'Pastor Sarah Johnson',
    title: 'Care Pastor — Grief & Crisis',
    bio: 'Specializing in grief counseling and crisis intervention. Former hospice chaplain with a heart for those walking through the darkest valleys.',
    photo: undefined,
    expertiseAreas: ['grief', 'crisis', 'anxiety-depression'],
    isAvailable: true,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'leader-3',
    personId: 'person-3',
    displayName: 'Deacon James Williams',
    title: 'Recovery Ministry Lead',
    bio: '15 years in recovery ministry. Leads our Celebrate Recovery program and mentors those overcoming addiction with compassion and accountability.',
    photo: undefined,
    expertiseAreas: ['addiction', 'financial', 'general'],
    isAvailable: false,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'leader-4',
    personId: 'person-4',
    displayName: 'Pastor Rachel Kim',
    title: 'Youth & Young Adults Pastor',
    bio: "Passionate about helping young people navigate faith, doubt, and life's big questions. Masters in Theology with a focus on apologetics.",
    photo: undefined,
    expertiseAreas: ['faith-questions', 'anxiety-depression', 'parenting'],
    isAvailable: true,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
];

// AI response templates per category
const AI_RESPONSES: Record<HelpCategory, string[]> = {
  'marriage': [
    "I'm glad you reached out. Marriage is one of the most meaningful relationships in our lives, and it's completely normal to need support. Can you tell me a bit more about what's been challenging?",
    "Thank you for sharing that. It takes courage to seek help. In my experience, communication is often at the heart of these challenges. How have things been between you and your spouse recently?",
    "I hear you, and what you're feeling is valid. Pastor Mike has extensive experience with exactly this kind of situation. Would you like me to share some initial thoughts, or would you prefer to schedule a time to speak with him directly?",
  ],
  'addiction': [
    "Thank you for reaching out — that takes real courage. You're not alone in this, and there is hope. Can you tell me a little about what you're going through?",
    "I want you to know that recovery is possible, and our church has resources specifically designed to support you. Our Celebrate Recovery program has helped many people find freedom.",
    "Deacon James leads our recovery ministry and has walked this road himself. He understands what you're going through. Would you like me to connect you with him?",
  ],
  'grief': [
    "I'm so sorry for your loss. Grief is one of the hardest journeys we walk, and there's no 'right' way to grieve. I'm here to listen whenever you're ready to share.",
    "Thank you for trusting us with your pain. What you're feeling — whether it's sadness, anger, confusion, or even numbness — all of it is a natural part of the process.",
    "Pastor Sarah has walked alongside many families through loss. She has a gift for being present without pushing. Would you like to talk more about what happened?",
  ],
  'faith-questions': [
    "Those are great questions! Doubt and curiosity are actually healthy parts of a growing faith. What's been on your mind?",
    "I love that you're wrestling with these things — it means you care deeply about truth. Let me share some thoughts that might help...",
    "Pastor Rachel specializes in exactly these kinds of conversations. She has a way of making space for honest questions without judgment. Would you like to explore this further?",
  ],
  'crisis': [
    "I want you to know that you're not alone right now, and reaching out was the right thing to do. Your safety matters to us above everything else.",
    "If you or someone you know is in immediate danger, please call 911 or the 988 Suicide & Crisis Lifeline. We want to help, and there are trained professionals available 24/7.",
    "I'm alerting our care team right now so someone can follow up with you quickly. Is there anything immediate I can do to help while we connect you?",
  ],
  'financial': [
    "Financial stress can feel overwhelming, but you don't have to navigate it alone. We have resources and people who can help. Can you share a bit about your situation?",
    "Thank you for being open about this. Many people face financial challenges, and our benevolence ministry exists specifically to walk alongside you during these times.",
    "I'd like to connect you with someone who can discuss both practical assistance and longer-term financial guidance. Would that be helpful?",
  ],
  'anxiety-depression': [
    "Thank you for reaching out. It takes strength to acknowledge what you're going through. You matter, and your mental health matters. Tell me more about what you've been experiencing.",
    "What you're describing sounds really difficult, and I want you to know it's not a sign of weak faith — it's a health issue that deserves compassion and support.",
    "We believe in supporting the whole person — spirit, mind, and body. Our pastors work alongside licensed counselors to provide comprehensive care. Would you like to talk about next steps?",
  ],
  'parenting': [
    "Parenting is one of the most rewarding and challenging roles we'll ever have. You're not alone in feeling this way. What's been going on?",
    "Every parent faces moments like these. The fact that you're seeking guidance shows how much you care. Let me share some thoughts that might help...",
    "We have several parents in our community who've walked similar paths. Would you like to connect with a support group or speak with one of our family ministry leaders?",
  ],
  'general': [
    "I'm glad you reached out! Whatever is on your mind, we're here to help. What would you like to talk about?",
    "Thank you for sharing. Let me think about the best way to support you with this...",
    "That makes sense. Would you like to continue chatting, or would you prefer to schedule a time to talk with one of our pastoral team members in person?",
  ],
};

function generateAnonymousId(): string {
  const words = ['Helper', 'Friend', 'Seeker', 'Guest', 'Visitor'];
  const word = words[Math.floor(Math.random() * words.length)];
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${word}-${code}`;
}

function matchLeader(category: HelpCategory, leaders: LeaderProfile[]): LeaderProfile | undefined {
  const available = leaders.filter(l => l.isActive && l.expertiseAreas.includes(category));
  const online = available.filter(l => l.isAvailable);
  if (online.length > 0) return online[0];
  if (available.length > 0) return available[0];
  return leaders.find(l => l.isActive);
}

function getPriority(category: HelpCategory): ConversationPriority {
  if (category === 'crisis') return 'crisis';
  if (category === 'anxiety-depression' || category === 'addiction') return 'high';
  return 'medium';
}

export function usePastoralCare() {
  const [leaders] = useState<LeaderProfile[]>(INITIAL_LEADERS);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [conversations, setConversations] = useState<PastoralConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const createHelpRequest = useCallback((request: {
    category: HelpCategory;
    description?: string;
    isAnonymous: boolean;
  }) => {
    const leader = matchLeader(request.category, leaders);
    const conversationId = `conv-${Date.now()}`;
    const anonymousId = request.isAnonymous ? generateAnonymousId() : undefined;
    const priority = getPriority(request.category);

    const newRequest: HelpRequest = {
      id: `req-${Date.now()}`,
      category: request.category,
      description: request.description,
      isAnonymous: request.isAnonymous,
      anonymousId,
      assignedLeaderId: leader?.id,
      conversationId,
      status: 'active',
      priority,
      createdAt: new Date().toISOString(),
    };

    // Build initial AI message
    const responses = AI_RESPONSES[request.category];
    const aiMessage: PastoralMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      sender: 'ai',
      senderName: leader ? `AI (${leader.displayName}'s Assistant)` : 'AI Care Assistant',
      content: responses[0],
      timestamp: new Date().toISOString(),
      aiConfidence: 0.92,
    };

    const messages: PastoralMessage[] = [];

    // If user provided a description, add it as their first message
    if (request.description) {
      messages.push({
        id: `msg-${Date.now() - 1}`,
        conversationId,
        sender: 'user',
        senderName: request.isAnonymous ? anonymousId! : 'You',
        content: request.description,
        timestamp: new Date(Date.now() - 1000).toISOString(),
      });
    }
    messages.push(aiMessage);

    const newConversation: PastoralConversation = {
      id: conversationId,
      helpRequestId: newRequest.id,
      personaId: leader?.id,
      leaderId: leader?.id,
      status: 'active',
      priority,
      category: request.category,
      isAnonymous: request.isAnonymous,
      personId: undefined,
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setHelpRequests(prev => [...prev, newRequest]);
    setConversations(prev => [...prev, newConversation]);
    setActiveConversationId(conversationId);
  }, [leaders]);

  const sendMessage = useCallback((conversationId: string, content: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== conversationId) return conv;

      const userMessage: PastoralMessage = {
        id: `msg-${Date.now()}`,
        conversationId,
        sender: 'user',
        senderName: conv.isAnonymous ? 'Anonymous' : 'You',
        content,
        timestamp: new Date().toISOString(),
      };

      // Simulate AI response
      const responses = AI_RESPONSES[conv.category];
      const responseIndex = Math.min(conv.messages.filter(m => m.sender === 'ai').length, responses.length - 1);
      const aiMessage: PastoralMessage = {
        id: `msg-${Date.now() + 1}`,
        conversationId,
        sender: 'ai',
        senderName: conv.leaderId
          ? `AI (${leaders.find(l => l.id === conv.leaderId)?.displayName || 'Pastor'}'s Assistant)`
          : 'AI Care Assistant',
        content: responses[responseIndex],
        timestamp: new Date(Date.now() + 1500).toISOString(),
        aiConfidence: 0.85 + Math.random() * 0.12,
      };

      return {
        ...conv,
        messages: [...conv.messages, userMessage, aiMessage],
        updatedAt: new Date().toISOString(),
      };
    }));
  }, [leaders]);

  const resolveConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId
        ? { ...conv, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
        : conv
    ));
    setHelpRequests(prev => prev.map(req =>
      req.conversationId === conversationId
        ? { ...req, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
        : req
    ));
  }, []);

  const escalateConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId
        ? { ...conv, status: 'escalated' as const, updatedAt: new Date().toISOString() }
        : conv
    ));
  }, []);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeLeader = activeConversation?.leaderId
    ? leaders.find(l => l.id === activeConversation.leaderId)
    : undefined;

  return {
    leaders,
    helpRequests,
    conversations,
    activeConversation,
    activeLeader,
    activeConversationId,
    setActiveConversationId,
    createHelpRequest,
    sendMessage,
    resolveConversation,
    escalateConversation,
  };
}
