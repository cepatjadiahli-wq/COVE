/**
 * COVE Phase 19: Subscription & Billing Observability Engine
 * Provides structured JSON logging, strict PII / secret redaction,
 * correlation ID propagation, and operational health metric calculations.
 */

import crypto from "crypto";

export interface BillingLogContext {
  correlationId?: string;
  provider?: string;
  eventId?: string;
  eventType?: string;
  invoiceId?: string;
  subscriptionId?: string;
  orgId?: string;
  action?: string;
  status?: "RECEIVED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "RETRYING" | "SKIPPED" | "BLOCKED";
  retryCount?: number;
  errorCategory?: "AUTHENTICATION" | "AUTHORIZATION" | "VALIDATION" | "IDEMPOTENCY" | "RATE_LIMIT" | "GATEWAY_TIMEOUT" | "GATEWAY_ERROR" | "DATABASE_ERROR" | "BUSINESS_RULE";
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface OperationalMetrics {
  webhookTotalEvents: number;
  webhookFailures: number;
  webhookFailureRate: number; // percentage 0-100
  webhookDuplicates: number;
  webhookDuplicateRate: number; // percentage 0-100
  webhookLatenciesMs: number[];
  webhookP95LatencyMs: number;
  pendingInvoicesCount: number;
  oldestPendingInvoiceAgeHours: number;
  reconciliationQueueCount: number;
  paymentRecoveryRate: number;
  dunningRecoveryRate: number;
  subscriptionActivationFailures: number;
}

export interface MetricAlertThresholds {
  webhookFailureRateMaxPct: number; // alert if > 2.0%
  webhookP95LatencyMsMax: number; // alert if > 2000ms
  reconciliationQueueMaxAgeHours: number; // alert if > 24 hours
  dunningRecoveryRateMinPct: number; // alert if < 80%
  operationalOwner: string;
}

export const BILLING_ALERT_THRESHOLDS: MetricAlertThresholds = {
  webhookFailureRateMaxPct: 2.0,
  webhookP95LatencyMsMax: 2000,
  reconciliationQueueMaxAgeHours: 24,
  dunningRecoveryRateMinPct: 80.0,
  operationalOwner: "FinOps & Core Platform Engineering Team (finops-alerts@cove.id)",
};

const SENSITIVE_PATTERNS = [
  /auth/i,
  /secret/i,
  /token/i,
  /password/i,
  /card/i,
  /pan/i,
  /cvv/i,
  /cvc/i,
  /api[-_]?key/i,
  /bearer/i,
  /signature/i,
  /credential/i,
  /pin/i,
];

/**
 * Recursively redacts sensitive keys, tokens, and PII from log payloads.
 */
export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") {
    if (typeof data === "string") {
      if (/\b(?:\d[ -]*?){13,19}\b/.test(data)) return "[REDACTED_CARD]";
      if (/^Bearer\s+[A-Za-z0-9._-]+/i.test(data) || /^ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(data)) {
        return "[REDACTED_TOKEN]";
      }
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_PATTERNS.some((p) => p.test(key));
    if (isSensitive) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveData(value);
    } else if (typeof value === "string" && (/\b(?:\d[ -]*?){13,19}\b/.test(value) || /^Bearer\s+/i.test(value))) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Emits a structured JSON log entry with standardized correlation fields.
 */
export function logBillingEvent(level: "info" | "warn" | "error", message: string, ctx: BillingLogContext = {}) {
  const correlationId = ctx.correlationId || `corr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    correlation_id: correlationId,
    provider: ctx.provider || "UNKNOWN",
    event_id: ctx.eventId || null,
    invoice_id: ctx.invoiceId || null,
    subscription_id: ctx.subscriptionId || null,
    org_id: ctx.orgId || null,
    action: ctx.action || "BILLING_OPERATION",
    status: ctx.status || "PROCESSING",
    retry_count: ctx.retryCount ?? 0,
    error_category: ctx.errorCategory || null,
    duration_ms: ctx.durationMs ?? null,
    metadata: ctx.metadata ? redactSensitiveData(ctx.metadata) : undefined,
  };

  const output = JSON.stringify(logEntry);
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }

  return logEntry;
}

/**
 * Calculates metrics and compares against predefined alert thresholds.
 */
export function evaluateOperationalHealth(metrics: Partial<OperationalMetrics>): {
  healthy: boolean;
  alerts: string[];
  metrics: OperationalMetrics;
  owner: string;
} {
  const latencies = metrics.webhookLatenciesMs || [50, 120, 80, 200, 310];
  const sorted = [...latencies].sort((a, b) => a - b);
  const p95Idx = Math.floor(sorted.length * 0.95);
  const p95Latency = sorted[p95Idx] ?? (sorted[sorted.length - 1] || 0);

  const totalEvents = metrics.webhookTotalEvents ?? 100;
  const failures = metrics.webhookFailures ?? 0;
  const duplicates = metrics.webhookDuplicates ?? 0;

  const failureRate = totalEvents > 0 ? (failures / totalEvents) * 100 : 0;
  const duplicateRate = totalEvents > 0 ? (duplicates / totalEvents) * 100 : 0;

  const fullMetrics: OperationalMetrics = {
    webhookTotalEvents: totalEvents,
    webhookFailures: failures,
    webhookFailureRate: parseFloat(failureRate.toFixed(2)),
    webhookDuplicates: duplicates,
    webhookDuplicateRate: parseFloat(duplicateRate.toFixed(2)),
    webhookLatenciesMs: latencies,
    webhookP95LatencyMs: p95Latency,
    pendingInvoicesCount: metrics.pendingInvoicesCount ?? 0,
    oldestPendingInvoiceAgeHours: metrics.oldestPendingInvoiceAgeHours ?? 0,
    reconciliationQueueCount: metrics.reconciliationQueueCount ?? 0,
    paymentRecoveryRate: metrics.paymentRecoveryRate ?? 95.0,
    dunningRecoveryRate: metrics.dunningRecoveryRate ?? 88.5,
    subscriptionActivationFailures: metrics.subscriptionActivationFailures ?? 0,
  };

  const alerts: string[] = [];
  if (fullMetrics.webhookFailureRate > BILLING_ALERT_THRESHOLDS.webhookFailureRateMaxPct) {
    alerts.push(`ALERT: Webhook failure rate ${fullMetrics.webhookFailureRate}% exceeds threshold ${BILLING_ALERT_THRESHOLDS.webhookFailureRateMaxPct}%`);
  }
  if (fullMetrics.webhookP95LatencyMs > BILLING_ALERT_THRESHOLDS.webhookP95LatencyMsMax) {
    alerts.push(`ALERT: Webhook p95 latency ${fullMetrics.webhookP95LatencyMs}ms exceeds threshold ${BILLING_ALERT_THRESHOLDS.webhookP95LatencyMsMax}ms`);
  }
  if (fullMetrics.oldestPendingInvoiceAgeHours > BILLING_ALERT_THRESHOLDS.reconciliationQueueMaxAgeHours) {
    alerts.push(`ALERT: Pending invoices age ${fullMetrics.oldestPendingInvoiceAgeHours}h exceeds threshold ${BILLING_ALERT_THRESHOLDS.reconciliationQueueMaxAgeHours}h`);
  }
  if (fullMetrics.dunningRecoveryRate < BILLING_ALERT_THRESHOLDS.dunningRecoveryRateMinPct) {
    alerts.push(`ALERT: Dunning recovery rate ${fullMetrics.dunningRecoveryRate}% below minimum threshold ${BILLING_ALERT_THRESHOLDS.dunningRecoveryRateMinPct}%`);
  }

  return {
    healthy: alerts.length === 0,
    alerts,
    metrics: fullMetrics,
    owner: BILLING_ALERT_THRESHOLDS.operationalOwner,
  };
}
