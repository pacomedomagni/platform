import { redirect } from 'next/navigation';

/**
 * Root page redirects to the full marketing landing page.
 * This ensures all visitors see the complete value proposition.
 */
export default function Index() {
  redirect('/landing');
}
