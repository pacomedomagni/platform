import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QueueService, EmailJobData, QueueName } from '@platform/queue';
import { EmailService } from '@platform/email';
import { Job } from 'bullmq';
import { PrismaService } from '@platform/db';

@Injectable()
export class EmailWorker implements OnModuleInit {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    // Register worker with 3 retry attempts and exponential backoff
    this.queueService.registerWorker(
      QueueName.EMAIL,
      this.processEmailJob.bind(this),
      5, // concurrency
    );
    this.logger.log('Email worker registered');
  }

  /**
   * Process email jobs from the queue
   */
  private async processEmailJob(job: Job<EmailJobData>): Promise<void> {
    const { emailOptions } = job.data;

    try {
      this.logger.debug(`Processing email job ${job.id}: ${emailOptions.subject}`);

      // Check bounce suppression before sending
      const tenantId = emailOptions.context?.tenantId as string | undefined;
      if (tenantId) {
        const recipientEmail = Array.isArray(emailOptions.to)
          ? emailOptions.to[0]
          : typeof emailOptions.to === 'string'
          ? emailOptions.to
          : emailOptions.to?.address;

        if (recipientEmail) {
          const bounce = await this.prisma.emailBounce.findFirst({
            where: {
              tenantId,
              email: recipientEmail,
              suppressed: true,
            },
          });

          if (bounce) {
            this.logger.warn(
              `Skipping email to suppressed address ${recipientEmail} (Job: ${job.id}, Bounce type: ${bounce.bounceType})`,
            );
            await this.logEmailAudit(job, 'success', undefined, 'Skipped: email address suppressed');
            return;
          }
        }
      }

      // Send the email
      const result = await this.emailService.send(emailOptions);

      this.logger.log(
        `Email sent successfully: ${result.messageId} (Job: ${job.id})`,
      );

      // Log success to audit log
      await this.logEmailAudit(job, 'success', result.messageId);
    } catch (error) {
      this.logger.error(
        `Failed to send email (Job: ${job.id}, Attempt: ${job.attemptsMade + 1}/${
          job.opts.attempts || 3
        }): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Log failure to audit log
      await this.logEmailAudit(
        job,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
      );

      // Re-throw to trigger retry
      throw error;
    }
  }

  /**
   * Log email send attempts to audit log
   */
  private async logEmailAudit(
    job: Job<EmailJobData>,
    status: 'success' | 'failed',
    messageId?: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const { emailOptions } = job.data;
      const tenantId = emailOptions.context?.tenantId as string | undefined;

      // Only log if we have a tenantId
      if (!tenantId) {
        return;
      }

      const recipientEmail = Array.isArray(emailOptions.to)
        ? emailOptions.to[0]
        : typeof emailOptions.to === 'string'
        ? emailOptions.to
        : emailOptions.to.address;

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: null,
          action: status === 'success' ? 'email-sent' : 'email-failed',
          docType: 'Email',
          docName: emailOptions.subject,
          meta: {
            jobId: job.id,
            recipient: recipientEmail,
            subject: emailOptions.subject,
            template: emailOptions.template,
            messageId,
            errorMessage,
            attemptsMade: job.attemptsMade,
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to log email audit', error);
      // Don't throw - we don't want audit logging failures to affect email sending
    }
  }
}
