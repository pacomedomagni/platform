/**
 * The root `/` page is a `redirect('/landing')` — there's nothing rendered
 * to assert on. Smoke-test the redirect target instead by importing the
 * module and confirming `redirect` is invoked. Trying to React.render a
 * component whose body throws via `redirect()` is meaningless.
 */
import Page from '../src/app/page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('Page', () => {
  it('redirects to /landing', () => {
    const { redirect } = jest.requireMock('next/navigation') as { redirect: jest.Mock };
    Page();
    expect(redirect).toHaveBeenCalledWith('/landing');
  });
});
