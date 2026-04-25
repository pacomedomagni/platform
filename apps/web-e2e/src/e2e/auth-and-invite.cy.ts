/**
 * Browser-driven happy path: signup form a11y/wiring + accept-invite UI.
 *
 * This is intentionally narrow:
 *   - exercises the same DOM the RTL tests cover, but in a real browser so
 *     we catch issues that jsdom misses (focus, hydration timing, css)
 *   - mocks the API responses with cy.intercept so the test doesn't need a
 *     running backend (covered separately by apps/api-e2e/30-* and 31-*)
 *
 * If you want a true end-to-end pass that includes the real API, run the
 * api-e2e suite — it covers the same flows server-side.
 */

describe('Signup form — a11y + password-manager wiring', () => {
  beforeEach(() => {
    cy.visit('/signup');
  });

  it('email input has autocomplete=email', () => {
    cy.get('#signup-email')
      .should('have.attr', 'autocomplete', 'email')
      .and('have.attr', 'type', 'email');
  });

  it('password input has autocomplete=new-password', () => {
    cy.get('#signup-password').should('have.attr', 'autocomplete', 'new-password');
  });

  it('business-name input has autocomplete=organization', () => {
    cy.get('#signup-business').should('have.attr', 'autocomplete', 'organization');
  });

  it('Continue button is disabled with empty form', () => {
    cy.contains('button', 'Continue').should('be.disabled');
  });

  it('"Sign in" link routes to /login', () => {
    cy.contains('a', 'Sign in').should('have.attr', 'href', '/login');
  });
});

describe('Accept-invite page — preview + form', () => {
  it('renders the form when preview returns 200', () => {
    cy.intercept('GET', '/api/v1/onboarding/invites/cy-token-1', {
      statusCode: 200,
      body: {
        data: {
          email: 'cypress@invite.test',
          firstName: null,
          lastName: null,
          roles: ['staff'],
          storeName: 'Cypress Co',
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      },
    }).as('preview');

    cy.visit('/onboarding/accept-invite/cy-token-1');
    cy.wait('@preview');
    cy.contains('Cypress Co').should('exist');
    cy.contains('cypress@invite.test').should('exist');
    cy.get('#invite-password').should('have.attr', 'autocomplete', 'new-password');
  });

  it('shows the gone UI when preview is 410', () => {
    cy.intercept('GET', '/api/v1/onboarding/invites/cy-token-2', {
      statusCode: 410,
      body: { message: 'This invite has expired.' },
    }).as('preview');

    cy.visit('/onboarding/accept-invite/cy-token-2');
    cy.wait('@preview');
    cy.contains(/no longer valid/i).should('exist');
    cy.contains(/expired/).should('exist');
  });

  it('blocks submit when passwords do not match', () => {
    cy.intercept('GET', '/api/v1/onboarding/invites/cy-token-3', {
      statusCode: 200,
      body: {
        data: {
          email: 'mismatch@invite.test',
          firstName: null,
          lastName: null,
          roles: ['staff'],
          storeName: 'Cypress Co',
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      },
    }).as('preview');

    cy.visit('/onboarding/accept-invite/cy-token-3');
    cy.wait('@preview');
    cy.get('#invite-password').type('goodpassword1');
    cy.get('#invite-confirm').type('differentpassword1');
    cy.contains('button', /accept/i).click();
    cy.contains(/do not match/i).should('exist');
  });
});
