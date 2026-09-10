/**
 * Zero-dependency watch-related asset constants. Split out of watchCatalog.ts
 * so tenant config files (centralHenderson.ts) can import these without
 * pulling in watchCatalog.ts's tenant-resolution import — that created a
 * circular import (tenant.ts → centralHenderson.ts → watchCatalog.ts → tenant.ts).
 */
// Served from apps/admin-web/public/watch/ — a copy, not a shared reference,
// of the matching art in marketing/assets/watch/ (Phase 1 plan M7: the real
// admin app must not depend on marketing/'s deployment to render its own
// Live Service Watch feature).
export const WATCH_LIVE_VIDEO_URL = '/watch/video/Church-Stage-video.mp4';

export const WATCH_THUMBNAIL_BASE = '/watch';

// TODO(Phase 1 M8): points at marketing/'s content by path, but marketing/
// has no deployed domain yet (M7 pulled it out of both apps entirely). Fill
// in the real domain once that deployment exists; path already reflects the
// tenant-scoped rename (grace_member_portal_central.html -> tenants/central-henderson/member-portal.html).
export const MEMBER_WATCH_PREVIEW_PATH = '/tenants/central-henderson/member-portal.html#watch';
