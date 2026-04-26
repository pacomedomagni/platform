import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { EmailService, EmailTemplateService } from '@platform/email';
import type { InviteEmailSender } from './admin-users.service';

const TEMPLATE_NAME = 'user-invite';

/**
 * Adapter that turns the generic EmailService into the narrow contract our
 * service needs (sendInviteEmail). Previously the HTML/text bodies were
 * built by string concatenation in this file — now they live in a Handlebars
 * template registered with EmailTemplateService at module init, which means:
 *   1. The renderer wraps the body with the platform's standard layout
 *      (header, brand styling, footer with unsubscribe-style fine print).
 *   2. The HTML can be edited / overridden by deploying a templates/
 *      directory and pointing EmailModule at it via templatesPath.
 *   3. Future invite-related emails (reminder, expired, accepted) can
 *      register similarly without touching this file's call sites.
 */
@Injectable()
export class InviteEmailSenderImpl implements InviteEmailSender, OnModuleInit {
  private readonly logger = new Logger(InviteEmailSenderImpl.name);

  constructor(
    @Optional() private readonly email?: EmailService,
    @Optional() private readonly templates?: EmailTemplateService,
  ) {}

  onModuleInit(): void {
    if (!this.templates) return;
    this.templates.compileTemplate({
      name: TEMPLATE_NAME,
      subject: "You're invited to {{storeName}}",
      html: INVITE_HTML,
      text: INVITE_TEXT,
    });
  }

  async sendInviteEmail(args: {
    tenantId: string;
    to: string;
    inviterName: string | null;
    storeName: string;
    inviteUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.email) {
      this.logger.warn(
        `EmailService not available — invite for ${args.to} not delivered. URL: ${args.inviteUrl}`,
      );
      return;
    }

    const expiresLabel = args.expiresAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const context = {
      storeName: args.storeName,
      inviterName: args.inviterName,
      inviteUrl: args.inviteUrl,
      expiresLabel,
    };

    if (this.templates && this.templates.hasTemplate?.(TEMPLATE_NAME)) {
      // Preferred path — template + layout wrapping.
      await this.email.send({
        to: args.to,
        subject: `You're invited to ${args.storeName}`,
        template: TEMPLATE_NAME,
        context,
      });
    } else {
      // Fallback: raw HTML if the template service isn't available (unit tests, etc.).
      await this.email.send({
        to: args.to,
        subject: `You're invited to ${args.storeName}`,
        html: renderRawInviteHtml(context),
        text: renderRawInviteText(context),
      });
    }
  }
}

// ─── Template body — Handlebars source ─────────────────────────────────────

const INVITE_HTML = `
<h1 style="font-size: 22px; margin: 0 0 12px;">You're invited to {{storeName}}</h1>
<p style="margin: 0 0 16px; color: #475569;">
  {{#if inviterName}}{{inviterName}} from {{/if}}{{storeName}} has invited you to join their team on NoSlag.
</p>
<p style="margin: 24px 0;">
  {{> button url=inviteUrl text="Accept invitation"}}
</p>
<p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
  This invitation expires on {{expiresLabel}}.
</p>
<p style="margin: 0; color: #94a3b8; font-size: 12px;">
  If the button doesn't work, paste this link into your browser:<br>
  <span style="word-break: break-all;">{{inviteUrl}}</span>
</p>
`.trim();

const INVITE_TEXT = `
You're invited to {{storeName}}

{{#if inviterName}}{{inviterName}} from {{/if}}{{storeName}} has invited you to join their team on NoSlag.

Accept here: {{inviteUrl}}

This invitation expires on {{expiresLabel}}.
`.trim();

// ─── Fallback renderers (used only when EmailTemplateService isn't injected) ──

function renderRawInviteHtml(ctx: {
  inviterName: string | null;
  storeName: string;
  inviteUrl: string;
  expiresLabel: string;
}): string {
  const inviter = ctx.inviterName ? `${escapeHtml(ctx.inviterName)} from ` : '';
  return `
<!doctype html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 32px auto; padding: 0 16px; color: #0f172a;">
  <h1 style="font-size: 22px; margin: 0 0 8px;">You're invited to ${escapeHtml(ctx.storeName)}</h1>
  <p style="margin: 0 0 16px; color: #475569;">
    ${inviter}${escapeHtml(ctx.storeName)} has invited you to join their team on NoSlag.
  </p>
  <p style="margin: 24px 0;">
    <a href="${escapeAttr(ctx.inviteUrl)}"
       style="display: inline-block; background: #4f46e5; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Accept invitation
    </a>
  </p>
  <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
    This invitation expires on ${escapeHtml(ctx.expiresLabel)}.
  </p>
</body>
</html>`.trim();
}

function renderRawInviteText(ctx: {
  inviterName: string | null;
  storeName: string;
  inviteUrl: string;
  expiresLabel: string;
}): string {
  const inviter = ctx.inviterName ? `${ctx.inviterName} from ` : '';
  return [
    `You're invited to ${ctx.storeName}`,
    '',
    `${inviter}${ctx.storeName} has invited you to join their team on NoSlag.`,
    '',
    `Accept here: ${ctx.inviteUrl}`,
    '',
    `This invitation expires on ${ctx.expiresLabel}.`,
  ].join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
