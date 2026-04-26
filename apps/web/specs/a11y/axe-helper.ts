/**
 * Thin wrapper around axe-core for jsdom-rendered React components.
 * Runs the WCAG 2.x AA rules and returns a list of human-readable violations
 * (empty list = clean). Use in jest tests like:
 *
 *   const { container } = render(<Page />);
 *   expect(await axeViolations(container)).toEqual([]);
 *
 * Color-contrast and visibility-dependent rules are skipped because jsdom
 * doesn't actually paint and reports unreliable values for those.
 */
import axe from 'axe-core';

export interface A11yViolation {
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  nodes: number;
}

const SKIP_RULES = [
  'color-contrast',          // jsdom doesn't render colors
  'document-title',          // RTL renders into a partial document
  'html-has-lang',           // ditto
  'landmark-one-main',       // RTL renders fragments, not full pages
  'page-has-heading-one',    // ditto
  'region',                  // ditto — landmarks aren't realistic in fragments
];

export async function axeViolations(node: Element): Promise<A11yViolation[]> {
  const result = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: SKIP_RULES.reduce<Record<string, { enabled: false }>>((acc, id) => {
      acc[id] = { enabled: false };
      return acc;
    }, {}),
  });
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? 'unknown',
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
  }));
}

/**
 * Pretty-print violations for jest failure messages so the trace is actionable.
 * `expect(violations).toEqual([])` would dump an opaque object diff — use this
 * inside a custom assertion when violations is non-empty:
 *
 *   if (violations.length) throw new Error(formatViolations(violations));
 */
export function formatViolations(violations: A11yViolation[]): string {
  if (!violations.length) return '0 a11y violations';
  return [
    `${violations.length} a11y violation${violations.length === 1 ? '' : 's'}:`,
    ...violations.map(
      (v) => `  • [${v.impact}] ${v.id} — ${v.help} (${v.nodes} node${v.nodes === 1 ? '' : 's'})\n    ${v.helpUrl}`,
    ),
  ].join('\n');
}
