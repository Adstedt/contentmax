import { createClient } from '@/lib/external/supabase/client';
import * as Sentry from '@sentry/nextjs';

export interface Alert {
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  title: string;
  message: string;
  error?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export class AlertManager {
  private supabase;
  private readonly adminEmail: string;

  constructor() {
    this.supabase = createClient();
    this.adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  }

  async sendFailureAlert(job: any, error: Error): Promise<void> {
    const alert: Alert = {
      level: 'ERROR',
      title: `Import Job Failed: ${job.type}`,
      message: `Job ${job.id} failed after ${job.retry_count || 0} retries`,
      error: error.message,
      metadata: {
        job_id: job.id,
        job_type: job.type,
        user_id: job.user_id,
        error_stack: error.stack,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to Sentry
    Sentry.captureException(error, {
      tags: {
        job_id: job.id,
        job_type: job.type,
        alert_level: 'ERROR',
      },
      extra: alert.metadata,
    });

    // Send email notification
    await this.sendEmail({
      to: this.adminEmail,
      subject: alert.title,
      template: 'job-failure',
      data: alert,
    });

    // Log to database
    await this.logAlert(alert);
  }

  async sendWarning(title: string, message: string, metadata?: Record<string, any>): Promise<void> {
    const alert: Alert = {
      level: 'WARNING',
      title,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Log to Sentry as breadcrumb
    Sentry.addBreadcrumb({
      message: title,
      level: 'warning',
      data: metadata,
    });

    // Log to database
    await this.logAlert(alert);
  }

  async sendInfo(title: string, message: string, metadata?: Record<string, any>): Promise<void> {
    const alert: Alert = {
      level: 'INFO',
      title,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Just log to database for INFO level
    await this.logAlert(alert);
  }

  async sendCritical(
    title: string,
    message: string,
    error?: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    const alert: Alert = {
      level: 'CRITICAL',
      title,
      message,
      error: error?.message,
      metadata: {
        ...metadata,
        error_stack: error?.stack,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to Sentry with high priority
    if (error) {
      Sentry.captureException(error, {
        level: 'fatal',
        tags: {
          alert_level: 'CRITICAL',
        },
        extra: alert.metadata,
      });
    } else {
      Sentry.captureMessage(message, 'fatal');
    }

    // Send immediate email
    await this.sendEmail({
      to: this.adminEmail,
      subject: `[CRITICAL] ${alert.title}`,
      template: 'critical-alert',
      data: alert,
      priority: 'high',
    });

    // Log to database
    await this.logAlert(alert);
  }

  private async logAlert(alert: Alert): Promise<void> {
    try {
      const { error } = await this.supabase.from('system_alerts').insert({
        level: alert.level,
        title: alert.title,
        message: alert.message,
        error: alert.error,
        metadata: alert.metadata,
        created_at: alert.timestamp || new Date().toISOString(),
      });

      if (error) {
        console.error('Failed to log alert to database:', error);
      }
    } catch (err) {
      console.error('Error logging alert:', err);
    }
  }

  private async sendEmail(config: {
    to: string;
    subject: string;
    template: string;
    data: any;
    priority?: 'high' | 'normal' | 'low';
  }): Promise<void> {
    // This would integrate with your email service (SendGrid, AWS SES, etc.)
    // For now, we'll just log it
    console.log('Email alert:', {
      to: config.to,
      subject: config.subject,
      priority: config.priority || 'normal',
      data: config.data,
    });

    // In production, you would call your email service here
    // Example with SendGrid:
    // await sgMail.send({
    //   to: config.to,
    //   from: process.env.FROM_EMAIL,
    //   subject: config.subject,
    //   templateId: config.template,
    //   dynamicTemplateData: config.data
    // });
  }

  async checkSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    metrics: Record<string, any>;
  }> {
    try {
      // Check database connection
      const { error: dbError } = await this.supabase.from('system_alerts').select('count').limit(1);

      if (dbError) {
        return {
          status: 'critical',
          metrics: { database: 'down', error: dbError.message },
        };
      }

      // Check recent error rate
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentAlerts } = await this.supabase
        .from('system_alerts')
        .select('level')
        .gte('created_at', oneHourAgo);

      const errorCount =
        recentAlerts?.filter((a) => a.level === 'ERROR' || a.level === 'CRITICAL').length || 0;
      const totalAlerts = recentAlerts?.length || 0;

      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (errorCount > 10) {
        status = 'critical';
      } else if (errorCount > 5) {
        status = 'degraded';
      }

      return {
        status,
        metrics: {
          database: 'up',
          recentErrors: errorCount,
          totalAlerts,
          errorRate: totalAlerts > 0 ? (errorCount / totalAlerts) * 100 : 0,
        },
      };
    } catch (error) {
      return {
        status: 'critical',
        metrics: { error: 'Failed to check system health' },
      };
    }
  }
}
