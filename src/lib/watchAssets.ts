/**
 * Zero-dependency watch-related asset constants. Split out of watchCatalog.ts
 * so tenant config files (centralHenderson.ts) can import these without
 * pulling in watchCatalog.ts's tenant-resolution import — that created a
 * circular import (tenant.ts → centralHenderson.ts → watchCatalog.ts → tenant.ts).
 */
export const WATCH_LIVE_VIDEO_URL = '/previews/assets/watch/video/Church-Stage-video.mp4';

export const WATCH_THUMBNAIL_BASE = '/previews/assets/watch';

export const MEMBER_WATCH_PREVIEW_PATH = '/previews/grace_member_portal_central.html#watch';
