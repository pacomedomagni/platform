/**
 * Server-side layout for the entire `/app/*` admin tree.
 *
 * The actual UI shell (sidebar, command bar, navigation state) lives in
 * the client component `_components/app-shell.tsx`. Splitting them lets
 * us export `dynamic = 'force-dynamic'` here — every page under `/app` is
 * an authenticated workspace, the data depends on per-user session state,
 * and several pages legitimately read `useSearchParams` for URL-driven
 * filter state. Trying to statically prerender this tree at build time
 * triggered "useSearchParams must be wrapped in Suspense" errors on
 * report pages and the marketplace listings page; opting out of static
 * generation is the architecturally correct fix and matches the runtime
 * behavior of the app.
 */
import AppShellClient from './_components/app-shell';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShellClient>{children}</AppShellClient>;
}
