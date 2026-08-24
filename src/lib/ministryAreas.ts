/**
 * The operational map, for the frontend.
 *
 * Re-exported from `api/_lib/ministryAreas.ts` rather than copied: the
 * Campus, the WorkOS, Settings, and the API must all agree on which areas
 * exist and what belongs to each, and two files drift. That module has no
 * imports, so it bundles cleanly into the browser.
 */
export * from '../../api/_lib/ministryAreas';
