/* Faithful's adapter for the shared phone-handoff panel.
 *
 * The panel itself lives in shared/grace-story-handoff.js so both tenants run
 * one implementation; this only supplies what is tenant-specific: where the
 * panel mounts, which step to hide while a code is on screen, and where the
 * segmentation answers come from.
 */
(() => {
  const host = document.querySelector('#sec-mobile .mobile-link-page');
  if (!host || !window.GRACE_STORY_HANDOFF) return;

  window.GRACE_STORY_HANDOFF.configure({
    mountAfter: host,
    hideWhileOpen: document.querySelector('[data-signup]'),
    segments: () => window.FAITHFUL_STORY_SEGMENTS?.get?.() ?? {},
  });

  window.FAITHFUL_STORY_HANDOFF = {
    start(payload) {
      // Resolved at call time: faithful-mobile-story.js builds [data-signup]
      // after this module runs.
      window.GRACE_STORY_HANDOFF.configure({
        hideWhileOpen: document.querySelector('[data-signup]'),
      });
      return window.GRACE_STORY_HANDOFF.start(payload);
    },
  };
})();
