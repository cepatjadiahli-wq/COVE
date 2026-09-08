// ============================================================================
// COVE Frontend — API Client (Gate P0-A)
// Attaches Bearer token to all requests; removes prototype endpoints.
// ============================================================================

import {getAuthToken} from './supabase';

const API_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL || 'http://localhost:3001/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, { ...options, headers });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    throw new Error(json.error || `HTTP error ${res.status}`);
  }
  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; service: string; version: string; uptime: number }>('/health'),

  // Auth & Session
  getMe: () => request<any>('/auth/me'),
  createOrganization: (data: { legalName: string; displayName?: string }) =>
    request<any>('/organizations', { method: 'POST', body: JSON.stringify(data) }),

  // Projects
  getProjects: (archived = false) => request<any[]>(`/projects?archived=${archived}`),
  getProject: (id: string) => request<any>(`/projects/${id}`),
  createProject: (data: any) => request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProjectStatus: (id: string, status: string) => request<any>(`/projects/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Ledger & 6 Stages
  getProjectLedger: (id: string) => request<any>(`/projects/${id}/ledger`),
  createLedgerEntry: (id: string, entry: any) => request<any>(`/projects/${id}/ledger/entry`, { method: 'POST', body: JSON.stringify(entry) }),

  // Commercial Actions
  getActions: (scope?: string) => request<any[]>(`/actions${scope ? `?scope=${scope}` : ''}`),
  createAction: (data: any) => request<any>('/actions', { method: 'POST', body: JSON.stringify(data) }),
  addActionNote: (id: string, note: string, resolve = false) => request<any>(`/actions/${id}/notes`, { method: 'POST', body: JSON.stringify({ note, resolve }) }),

  // Invoices & Cash Receipts
  getInvoices: () => request<any[]>('/invoices'),
  createInvoice: (data: any) => request<any>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  recordCashReceipt: (data: { projectId: string; amount?: number; receivedAmount?: number; bankReference: string; allocations: Array<{ invoiceId: string; amount: number }> }) =>
    request<any>('/invoices/receipts', { method: 'POST', body: JSON.stringify({ ...data, amount: data.amount ?? data.receivedAmount }) }),

  // Reports
  getPortfolioReport: () => request<any>('/reports/portfolio'),
  getGapsReport: () => request<any>('/reports/gaps'),
  getAgingReport: () => request<any>('/reports/aging'),
  getForecastReport: () => request<any>('/reports/forecast'),

  // SaaS Billing & Checkout
  getBilling: () => request<any>('/billing'),
  createCheckout: (planId: string) => request<any>('/billing/checkout', { method: 'POST', body: JSON.stringify({ planId }) }),

  // Support
  getTickets: () => request<any[]>('/support/tickets'),
  createTicket: (data: any) => request<any>('/support/tickets', { method: 'POST', body: JSON.stringify(data) }),
  addTicketMessage: (id: string, message: string) => request<any>(`/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  getFeatures: () => request<any[]>('/support/features'),
  createFeature: (data: any) => request<any>('/support/features', { method: 'POST', body: JSON.stringify(data) }),

  // Admin Operations (Requires Platform Administrator Token)
  getAdminMetrics: () => request<any>('/admin/metrics'),
  getAdminWebhooks: () => request<any[]>('/admin/webhooks'),
  getAdminLeads: () => request<any[]>('/admin/recovery/leads'),
  getRecoveryTemplate: (leadId: string) => request<any>('/admin/recovery/template', { method: 'POST', body: JSON.stringify({ leadId }) }),
};
