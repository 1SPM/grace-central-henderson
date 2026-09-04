/**
 * Staff moderation queue for the Members Portal community feed (TD-051).
 * The backend (community_posts.moderation_status, community_post_reports,
 * member_blocks) has been real and RLS-tested since migration 043; this is
 * the first UI that reads or acts on it.
 */
import { Flag, ShieldAlert, Check, X, Trash2 } from 'lucide-react';
import { useCommunityModerationQueue, type ModerationQueuePost, type ReportedQueuePost } from '../../hooks/useCommunityModerationQueue';

const POST_TYPE_LABELS: Record<string, string> = {
  blessing: 'Blessing',
  praise: 'Praise report',
  scripture: 'Shared verse',
};

function DecisionButtons({ postId, decidingId, onDecide }: { postId: string; decidingId: string | null; onDecide: (id: string, decision: 'approved' | 'rejected' | 'removed') => void }) {
  const busy = decidingId === postId;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => onDecide(postId, 'approved')}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-500/10 dark:text-emerald-400"
      >
        <Check size={13} /> Approve
      </button>
      <button
        onClick={() => onDecide(postId, 'rejected')}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-dark-700 dark:text-dark-300"
      >
        <X size={13} /> Reject
      </button>
      <button
        onClick={() => onDecide(postId, 'removed')}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:bg-brand-500/10 dark:text-brand-400"
      >
        <Trash2 size={13} /> Remove
      </button>
    </div>
  );
}

function PostCard({ post, decidingId, onDecide, children }: {
  post: ModerationQueuePost;
  decidingId: string | null;
  onDecide: (id: string, decision: 'approved' | 'rejected' | 'removed') => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-4 p-3 rounded-lg border border-gray-200 dark:border-dark-700">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400 mb-1">
          <span className="font-medium text-gray-700 dark:text-dark-200">{post.author_name}</span>
          <span>·</span>
          <span>{POST_TYPE_LABELS[post.post_type] ?? post.post_type}</span>
          <span>·</span>
          <span>{new Date(post.created_at).toLocaleString()}</span>
        </div>
        <p className="text-sm text-gray-900 dark:text-dark-100">{post.body}</p>
        {children}
      </div>
      <DecisionButtons postId={post.id} decidingId={decidingId} onDecide={onDecide} />
    </li>
  );
}

export function CommunityModerationPage() {
  const { pending, reported, isLoading, error, forbidden, decidingId, decide } = useCommunityModerationQueue();

  if (forbidden) {
    return (
      <div className="p-4 sm:p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include community moderation access.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-dark-100">Community Moderation</h1>
        <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">Members Portal community posts awaiting review or reported after publishing.</p>
      </div>

      {error && <p className="text-sm text-brand-600 dark:text-brand-400">{error}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <section aria-labelledby="moderation-pending" className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6">
            <h2 id="moderation-pending" className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-3 flex items-center gap-1.5">
              <ShieldAlert size={16} /> Awaiting first review
              {pending.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300">{pending.length}</span>}
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-dark-500">Nothing waiting — the queue is clear.</p>
            ) : (
              <ul className="space-y-2" data-testid="moderation-pending-list">
                {pending.map(post => <PostCard key={post.id} post={post} decidingId={decidingId} onDecide={decide} />)}
              </ul>
            )}
          </section>

          <section aria-labelledby="moderation-reported" className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6">
            <h2 id="moderation-reported" className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-3 flex items-center gap-1.5">
              <Flag size={16} /> Reported after publishing
              {reported.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">{reported.length}</span>}
            </h2>
            {reported.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-dark-500">No open reports.</p>
            ) : (
              <ul className="space-y-2" data-testid="moderation-reported-list">
                {reported.map((post: ReportedQueuePost) => (
                  <PostCard key={post.id} post={post} decidingId={decidingId} onDecide={decide}>
                    <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
                      {post.report_count} report{post.report_count === 1 ? '' : 's'}
                      {post.report_reasons.length > 0 && <> — {post.report_reasons.join('; ')}</>}
                    </p>
                  </PostCard>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
