import { useState } from 'react';
import { Users, CalendarDays, Heart, MessageCircle, Send, Sparkles } from 'lucide-react';
import { usePortalGroups } from '../hooks/usePortalGroups';
import { usePortalEvents } from '../hooks/usePortalEvents';
import { usePortalVolunteer } from '../hooks/usePortalVolunteer';
import { usePortalContact } from '../hooks/usePortalContact';
import { usePortalRequests } from '../hooks/usePortalRequests';
import { usePortalCommunityFeed, COMPOSABLE_POST_TYPES, type CommunityPost, type ComposablePostType } from '../hooks/usePortalCommunityFeed';
import { VOLUNTEER_OPPORTUNITIES } from '../volunteerOpportunities';

const POST_TYPE_LABELS: Record<ComposablePostType, string> = {
  blessing: 'Blessing',
  praise: 'Praise report',
  scripture: 'Share a verse',
};

const POST_TYPE_PROMPTS: Record<ComposablePostType, string> = {
  blessing: "What's something good God has done for you lately?",
  praise: 'Share a praise report with the church…',
  scripture: 'Share a verse that’s been on your heart…',
};

function ModerationStatusNote({ status }: { status: CommunityPost['moderation_status'] }) {
  if (status === 'pending') return <span className="text-amber-600">Awaiting approval — only you can see this</span>;
  if (status === 'rejected') return <span className="text-stone-400">Not approved for the church feed</span>;
  if (status === 'removed') return <span className="text-stone-400">Removed</span>;
  return null;
}

function CommunityFeedSection() {
  const { posts, isLoading, error, isPosting, reactingKey, submitPost, toggleReaction, reportPost, blockMember } = usePortalCommunityFeed();
  const [postType, setPostType] = useState<ComposablePostType>('blessing');
  const [draft, setDraft] = useState('');
  const [justPosted, setJustPosted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await submitPost(postType, draft.trim());
    setDraft('');
    setJustPosted(true);
    setTimeout(() => setJustPosted(false), 4000);
  }

  async function handleBlock(post: CommunityPost) {
    if (!window.confirm(`Block ${post.author_name}? You won't see each other's posts anymore. You can undo this later from your profile.`)) return;
    await blockMember(post.author_person_id);
  }

  return (
    <section aria-labelledby="portal-community-feed" className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 id="portal-community-feed" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><Sparkles size={16} /> Community feed</h2>

      <form onSubmit={handleSubmit} className="space-y-2 mb-4 pb-4 border-b border-stone-100">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Post type">
          {COMPOSABLE_POST_TYPES.map(type => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={postType === type}
              onClick={() => setPostType(type)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                postType === type ? 'bg-rose-600 text-white border-rose-600' : 'border-stone-300 text-stone-600'
              }`}
            >
              {POST_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <label htmlFor="community-post-body" className="sr-only">{POST_TYPE_LABELS[postType]}</label>
        <textarea
          id="community-post-body"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={POST_TYPE_PROMPTS[postType]}
          rows={2}
          maxLength={2000}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between">
          {justPosted ? (
            <p className="text-xs text-emerald-600">Posted — a moderator will approve it before it appears in the feed.</p>
          ) : <span />}
          <button type="submit" disabled={isPosting || !draft.trim()} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
            {isPosting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

      {isLoading ? (
        <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
      ) : posts.length === 0 ? (
        <p className="text-sm text-stone-400">No posts yet — be the first to share a blessing or praise report.</p>
      ) : (
        <ul className="space-y-4" data-testid="community-feed-list">
          {posts.map(post => (
            <li key={post.id} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-stone-800">{post.author_name}</p>
                <span className="text-xs text-stone-400 shrink-0">{POST_TYPE_LABELS[post.post_type as ComposablePostType] ?? post.post_type}</span>
              </div>
              <p className="text-stone-700 mt-0.5">{post.body}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-stone-400">
                  {new Date(post.created_at).toLocaleDateString()}
                  {post.is_mine && post.moderation_status !== 'approved' && <> · <ModerationStatusNote status={post.moderation_status} /></>}
                </p>
                {!post.is_mine && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void toggleReaction(post.id, 'pray')}
                      disabled={reactingKey === `${post.id}:pray`}
                      aria-pressed={post.my_reactions.includes('pray')}
                      className={`text-xs font-medium ${post.my_reactions.includes('pray') ? 'text-rose-600' : 'text-stone-500'}`}
                    >
                      🙏 Pray {post.reaction_counts.pray ? `(${post.reaction_counts.pray})` : ''}
                    </button>
                    <button
                      onClick={() => void toggleReaction(post.id, 'amen')}
                      disabled={reactingKey === `${post.id}:amen`}
                      aria-pressed={post.my_reactions.includes('amen')}
                      className={`text-xs font-medium ${post.my_reactions.includes('amen') ? 'text-rose-600' : 'text-stone-500'}`}
                    >
                      🙌 Amen {post.reaction_counts.amen ? `(${post.reaction_counts.amen})` : ''}
                    </button>
                    <button onClick={() => void reportPost(post.id)} className="text-xs text-stone-400 hover:text-stone-600">Report</button>
                    <button onClick={() => void handleBlock(post)} className="text-xs text-stone-400 hover:text-stone-600">Block</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GroupStatusBadge({ status }: { status: string | null }) {
  if (status === 'active') return <span className="text-xs font-medium text-emerald-600">Member</span>;
  if (status === 'pending') return <span className="text-xs font-medium text-amber-600">Requested</span>;
  return null;
}

export function PortalCommunity() {
  const { groups, isLoading: groupsLoading, joiningId, requestToJoin } = usePortalGroups();
  const { events, isLoading: eventsLoading, rsvpingId, rsvp } = usePortalEvents();
  const { submit: submitVolunteer, isSubmitting: volunteerSubmitting } = usePortalVolunteer();
  const { submit: submitContact, isSubmitting: contactSubmitting } = usePortalContact();
  const { requests } = usePortalRequests();

  const [volunteerArea, setVolunteerArea] = useState(VOLUNTEER_OPPORTUNITIES[0]?.key ?? '');
  const [volunteerSent, setVolunteerSent] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  async function handleVolunteerSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitVolunteer(volunteerArea);
    setVolunteerSent(true);
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactSubject.trim() || !contactMessage.trim()) return;
    await submitContact(contactSubject.trim(), contactMessage.trim());
    setContactSent(true);
    setContactSubject('');
    setContactMessage('');
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">My Community</h1>
        <p className="text-sm text-stone-500 mt-1">Find your people, your next event, and a place to serve.</p>
      </div>

      <div className="rounded-xl bg-stone-100 px-4 py-2.5 text-xs text-stone-500 flex items-center gap-1.5">
        <MessageCircle size={14} /> Looking for prayer requests or pastoral care? See the Care &amp; Prayer tab — the feed below is for blessings, praise reports, and scripture.
      </div>

      <CommunityFeedSection />

      <section aria-labelledby="portal-community-groups" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-community-groups" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><Users size={16} /> Groups</h2>
        {groupsLoading ? (
          <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
        ) : groups.length === 0 ? (
          <p className="text-sm text-stone-400">No groups published yet.</p>
        ) : (
          <ul className="space-y-3" data-testid="portal-group-list">
            {groups.map(g => (
              <li key={g.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800">{g.name}</p>
                  {g.meeting_day && <p className="text-xs text-stone-500">{g.meeting_day} {g.meeting_time}</p>}
                </div>
                {g.my_status ? (
                  <GroupStatusBadge status={g.my_status} />
                ) : (
                  <button
                    onClick={() => void requestToJoin(g.id)}
                    disabled={joiningId === g.id}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-rose-600 text-white disabled:opacity-50"
                  >
                    {joiningId === g.id ? 'Requesting…' : 'Request to join'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="portal-community-events" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-community-events" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><CalendarDays size={16} /> Events</h2>
        {eventsLoading ? (
          <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
        ) : events.length === 0 ? (
          <p className="text-sm text-stone-400">No upcoming events yet.</p>
        ) : (
          <ul className="space-y-3" data-testid="portal-event-list">
            {events.map(e => (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800">{e.title}</p>
                  <p className="text-xs text-stone-500">{new Date(e.start_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {(['yes', 'maybe', 'no'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => void rsvp(e.id, status)}
                      disabled={rsvpingId === e.id}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                        e.my_rsvp?.status === status ? 'bg-rose-600 text-white border-rose-600' : 'border-stone-300 text-stone-600'
                      }`}
                    >
                      {status === 'yes' ? 'Going' : status === 'maybe' ? 'Maybe' : "Can't go"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="portal-community-volunteer" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-community-volunteer" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><Heart size={16} /> Volunteer</h2>
        {volunteerSent ? (
          <p className="text-sm text-emerald-600">Thanks — your interest has been sent to the team.</p>
        ) : (
          <form onSubmit={handleVolunteerSubmit} className="space-y-2">
            <label htmlFor="volunteer-area" className="text-xs font-medium text-stone-600">Area</label>
            <select
              id="volunteer-area"
              value={volunteerArea}
              onChange={e => setVolunteerArea(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            >
              {VOLUNTEER_OPPORTUNITIES.map(o => <option key={o.key} value={o.key}>{o.title}</option>)}
            </select>
            <button type="submit" disabled={volunteerSubmitting} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
              {volunteerSubmitting ? 'Sending…' : "I'm interested"}
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="portal-community-contact" className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 id="portal-community-contact" className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-1.5"><Send size={16} /> Contact the church</h2>
        {contactSent ? (
          <p className="text-sm text-emerald-600">Your message has been sent to the team.</p>
        ) : (
          <form onSubmit={handleContactSubmit} className="space-y-2">
            <label htmlFor="contact-subject" className="sr-only">Subject</label>
            <input
              id="contact-subject"
              value={contactSubject}
              onChange={e => setContactSubject(e.target.value)}
              placeholder="Subject"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <label htmlFor="contact-message" className="sr-only">Message</label>
            <textarea
              id="contact-message"
              value={contactMessage}
              onChange={e => setContactMessage(e.target.value)}
              placeholder="How can we help?"
              rows={3}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <button type="submit" disabled={contactSubmitting || !contactSubject.trim() || !contactMessage.trim()} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50">
              {contactSubmitting ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </section>

      {requests.length > 0 && (
        <section aria-labelledby="portal-community-requests" className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 id="portal-community-requests" className="text-sm font-semibold text-stone-900 mb-3">Your requests</h2>
          <ul className="space-y-2" data-testid="portal-request-status-list">
            {requests.map(r => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-700">{r.title}</span>
                <span className="text-xs font-medium text-stone-500">{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
