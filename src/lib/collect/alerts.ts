import type { Logger } from "./types";

/**
 * Alerting for failed or suspicious collection runs.
 *
 * The delivery channel is still an open decision (AGENTS.md section 14), so
 * this ships with a console sink behind an interface. Replacing it with email,
 * a webhook or a chat integration is a single implementation.
 */

export interface Alert {
  severity: "warning" | "critical";
  providerId?: string;
  title: string;
  detail: string;
  at: Date;
}

export interface AlertSink {
  send(alert: Alert): Promise<void>;
}

export function createConsoleAlertSink(logger: Logger): AlertSink {
  return {
    async send(alert) {
      const meta = { providerId: alert.providerId, detail: alert.detail, at: alert.at.toISOString() };
      if (alert.severity === "critical") {
        logger.error(`ALERT: ${alert.title}`, meta);
      } else {
        logger.warn(`ALERT: ${alert.title}`, meta);
      }
    },
  };
}

export function createMemoryAlertSink(): AlertSink & { alerts: Alert[] } {
  const alerts: Alert[] = [];
  return {
    alerts,
    async send(alert) {
      alerts.push(alert);
    },
  };
}
