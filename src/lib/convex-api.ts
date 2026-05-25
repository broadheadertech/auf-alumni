/**
 * Re-export of Convex's generated API surface.
 *
 * The `@/lib/convex-api` alias lets frontend code import `api` without
 * juggling relative paths into `../../../convex/_generated/api`.
 *
 * Requires `npx convex dev` (or `npx convex codegen`) to have run at least
 * once so the generated file exists.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated at codegen time; missing until `npx convex dev` runs
export { api, internal } from "../../convex/_generated/api";
