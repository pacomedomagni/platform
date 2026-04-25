import { Injectable, Logger, Optional } from '@nestjs/common';
import { EmailService } from '@platform/email';
import type { InviteEmailSender } from './admin-users.service';

/**
 * Adapter that turns the generic EmailService into the narrow contract our
 * service needs (sendInviteEmail). Lives in a separate file so the service can
 * be unit-tested without dragging the whole email module into the test graph.
 */
@Injectable()
export class InviteEmailSenderImpl implements InviteEmailSender {
  private readonly logger = new Logger(InviteEmailSenderImpl.name);

  constructor(@Optional() private readonly email?: EmailService) {}

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

    const inviter = args.inviterName ? `${args.inviterName} from ` : '';
    const expiresLabel = args.expiresAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    await this.email.send({
      to: args.to,
      subject: `You're invited to ${args.storeName}`,
      html: renderInviteHtml({
        inviter,
        storeName: args.storeName,
        inviteUrl: args.inviteUrl,
        expiresLabel,
      }),
      text: renderInviteText({
        inviter,
        storeName: args.storeName,
        inviteUrl: args.inviteUrl,
        expiresLabel,
      }),
    });
  }
}

function renderInviteHtml(args: {
  inviter: string;
  storeName: string;
  inviteUrl: string;
  expiresLabel: string;
}): string {
  return `
<!doctype html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 32px auto; padding: 0 16px; color: #0f172a;">
  <h1 style="font-size: 22px; margin: 0 0 8px;">You're invited to ${escapeHtml(args.storeName)}</h1>
  <p style="margin: 0 0 16px; color: #475569;">
    ${escapeHtml(args.inviter)}${escapeHtml(args.storeName)} has invited you to join their team on NoSlag.
  </p>
  <p style="margin: 24px 0;">
    <a href="${escapeAttr(args.inviteUrl)}"
       style="display: inline-block; background: #4f46e5; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Accept invitation
    </a>
  </p>
  <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
    This invitation expires on ${escapeHtml(args.expiresLabel)}.
  </p>
  <p style="margin: 0; color: #94a3b8; font-size: 12px;">
    If the button doesn't work, paste this link into your browser:<br>
    <span style="word-break: break-all;">${escapeHtml(args.inviteUrl)}</span>
  </p>
</body>
</html>`.trim();
}

function renderInviteText(args: {
  inviter: string;
  storeName: string;
  inviteUrl: string;
  expiresLabel: string;
}): string {
  return [
    `You're invited to ${args.storeName}`,
    '',
    `${args.inviter}${args.storeName} has invited you to join their team on NoSlag.`,
    '',
    `Accept here: ${args.inviteUrl}`,
    '',
    `This invitation expires on ${args.expiresLabel}.`,
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
