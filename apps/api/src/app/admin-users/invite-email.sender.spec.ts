/**
 * Unit tests for InviteEmailSenderImpl.
 *
 * Two pathways:
 *   1. EmailTemplateService is available → render via the registered Handlebars
 *      template (so the platform layout wraps it, future template overrides
 *      land via templatesPath, etc.)
 *   2. Template service NOT available → fall back to inline HTML/text
 *
 * Also: missing EmailService is a no-op (we log + return), failed delivery
 * propagates so the caller can decide what to do.
 */
import { Test } from '@nestjs/testing';
import { InviteEmailSenderImpl } from './invite-email.sender';

function makeEmailMock() {
  return { send: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
}

function makeTemplatesMock() {
  return {
    compileTemplate: jest.fn(),
    hasTemplate: jest.fn().mockReturnValue(true),
  };
}

const baseArgs = {
  tenantId: 'tenant-1',
  to: 'invitee@example.test',
  inviterName: 'Alice Owner',
  storeName: 'Acme Inc',
  inviteUrl: 'https://app.example.test/onboarding/accept-invite/abc123',
  expiresAt: new Date('2026-04-30T15:00:00Z'),
};

describe('InviteEmailSenderImpl', () => {
  describe('with EmailTemplateService', () => {
    let sender: InviteEmailSenderImpl;
    let email: ReturnType<typeof makeEmailMock>;
    let templates: ReturnType<typeof makeTemplatesMock>;

    beforeEach(async () => {
      email = makeEmailMock();
      templates = makeTemplatesMock();
      const moduleRef = await Test.createTestingModule({
        providers: [InviteEmailSenderImpl],
      })
        .overrideProvider(InviteEmailSenderImpl)
        .useFactory({ factory: () => new InviteEmailSenderImpl(email as any, templates as any) })
        .compile();
      sender = moduleRef.get(InviteEmailSenderImpl);
    });

    it('compiles the user-invite template on module init', () => {
      sender.onModuleInit();
      expect(templates.compileTemplate).toHaveBeenCalledTimes(1);
      const arg = templates.compileTemplate.mock.calls[0][0];
      expect(arg.name).toBe('user-invite');
      expect(arg.subject).toContain('{{storeName}}');
      expect(arg.html).toContain('{{inviteUrl}}');
      expect(arg.text).toContain('{{inviteUrl}}');
    });

    it('sends with template + context (not raw html)', async () => {
      sender.onModuleInit();
      await sender.sendInviteEmail(baseArgs);
      expect(email.send).toHaveBeenCalledTimes(1);
      const sent = email.send.mock.calls[0][0];
      expect(sent.template).toBe('user-invite');
      expect(sent.html).toBeUndefined();
      expect(sent.context).toMatchObject({
        storeName: 'Acme Inc',
        inviterName: 'Alice Owner',
        inviteUrl: baseArgs.inviteUrl,
      });
      expect(typeof sent.context.expiresLabel).toBe('string');
    });

    it('falls back to raw HTML when the template was not registered', async () => {
      templates.hasTemplate.mockReturnValue(false);
      await sender.sendInviteEmail(baseArgs);
      const sent = email.send.mock.calls[0][0];
      expect(sent.template).toBeUndefined();
      expect(sent.html).toContain('Acme Inc');
      expect(sent.html).toContain(baseArgs.inviteUrl);
      expect(sent.text).toContain(baseArgs.inviteUrl);
    });
  });

  describe('without EmailTemplateService (template DI optional)', () => {
    it('uses raw HTML fallback', async () => {
      const email = makeEmailMock();
      const sender = new InviteEmailSenderImpl(email as any, undefined);
      await sender.sendInviteEmail(baseArgs);
      const sent = email.send.mock.calls[0][0];
      expect(sent.template).toBeUndefined();
      expect(sent.html).toContain('Acme Inc');
    });
  });

  describe('without EmailService', () => {
    it('is a no-op (logs and returns)', async () => {
      const sender = new InviteEmailSenderImpl(undefined, undefined);
      await expect(sender.sendInviteEmail(baseArgs)).resolves.toBeUndefined();
    });
  });

  describe('inviterName handling', () => {
    it('omits "from {inviter}" prefix in raw HTML when inviterName is null', async () => {
      const email = makeEmailMock();
      const sender = new InviteEmailSenderImpl(email as any, undefined);
      await sender.sendInviteEmail({ ...baseArgs, inviterName: null });
      const sent = email.send.mock.calls[0][0];
      expect(sent.html).not.toContain('from ');
      expect(sent.text).not.toContain('from ');
    });

    it('passes inviterName through to template context as-is (renderer handles {{#if}})', async () => {
      const email = makeEmailMock();
      const templates = makeTemplatesMock();
      const sender = new InviteEmailSenderImpl(email as any, templates as any);
      sender.onModuleInit();
      await sender.sendInviteEmail({ ...baseArgs, inviterName: null });
      const sent = email.send.mock.calls[0][0];
      expect(sent.context.inviterName).toBeNull();
    });
  });
});
