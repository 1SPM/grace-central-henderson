/**
 * Express types every entry in `req.params` as `string | string[]`, because a
 * path can capture the same name more than once (`/a/:id/b/:id`). Every route
 * in this API declares each parameter exactly once, so only the string case
 * occurs at runtime — but the compiler cannot know that, and the untyped code
 * was passing the union straight into Stripe calls and object index positions.
 *
 * This narrows without changing behaviour for any request the routes actually
 * accept. The array branch exists so a future repeated capture degrades to the
 * first value rather than reaching a client library as an array.
 */
export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}
