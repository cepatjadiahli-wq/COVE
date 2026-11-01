// ============================================================================
// COVE Frontend — Workspace State Store (Gate P0-A)
// Integrates with Supabase Auth, eliminates privilege escalation switch-role.
// ============================================================================

import {createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode} from 'react';
import type {
  Project,
  Action,
  Invoice,
  DocumentRecord,
  Ticket,
  Feature,
  RecoveryLead
} from './domain';
import { INITIAL_JOURNEY, parsePlan, type Journey } from './journey';
import { readConsent, saveConsent } from './privacy';
import { api, setActiveOrganizationId } from './api';
import { supabase } from './supabase';

export type TenantRole =
  | 'OWNER'
  | 'ADMIN'
  | 'COMMERCIAL_MANAGER'
  | 'QS'
  | 'PROJECT_MANAGER'
  | 'FINANCE_MANAGER'
  | 'EXECUTIVE_VIEWER'
  | 'AUDITOR'
  | 'COVE_IMPLEMENTATION';

export type AppState = 'normal' | 'empty' | 'loading' | 'error' | 'denied' | 'restricted' | 'stale' | 'conflict';
export type PreviewState = AppState;
export type PreviewRole = TenantRole;
export type Draft = { title: string; description: string; at: string };

function useWorkspaceStore() {
  const [journey, setJourney] = useState<Journey>({ ...INITIAL_JOURNEY });
  const [tracking, setTracking] = useState({ enabled: false, verified: false, pixelId: '' });
  const [consentOpen, setConsentOpen] = useState(false);

  // Production collections initialize empty (Section E: zero production seed runtime)
  const [projects, setProjects] = useState<Project[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [recoveryLeads, setRecoveryLeads] = useState<RecoveryLead[]>([]);

  // Authentication & Actor State (PRD v2.2 / Section C: server-authoritative startup)
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [actor, setActor] = useState<any | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [role, setRoleState] = useState<TenantRole | null>(null);
  const [company, setCompany] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('cove_active_org_id') : null);
  const [tenantOptions, setTenantOptions] = useState<Array<{ orgId: string; membershipId: string; role: string; legalName: string; displayName: string }>>([]);
  const [tenantSelectionRequired, setTenantSelectionRequired] = useState(false);

  const [state, setState] = useState<AppState>('normal');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState('');
  const [subscription, setSubscription] = useState('Non-Aktif');
  const [consents, setConsents] = useState(readConsent);
  const [readNotifications, setReadNotifications] = useState(false);
  const [onboarding, setOnboarding] = useState({ company: '', name: '', project: '', contract: '', customer: '', step: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const journeyRef = useRef(journey);
  useEffect(() => { journeyRef.current = journey; }, [journey]);
  const sessionVersion = useRef(0);
  const sessionUserId = useRef<string | null>(null);
  const tenantIdRef = useRef(selectedTenantId);
  const reloadRequest = useRef<Promise<Journey> | null>(null);

  useEffect(() => saveConsent(consents), [consents]);

  /**
   * Clears all tenant-scoped session state. Called on logout and SIGNED_OUT auth event.
   * Prevents stale tenant context leaking across accounts.
   */
  const clearTenantSessionState = useCallback(() => {
    sessionVersion.current += 1;
    reloadRequest.current = null;
    tenantIdRef.current = null;
    setActor(null);
    setUserName('');
    setUserEmail('');
    setRoleState(null);
    setCompany('');
    setSelectedTenantId(null);
    setTenantOptions([]);
    setTenantSelectionRequired(false);
    setActiveOrganizationId(null); // also clears localStorage cove_active_org_id
    setProjects([]);
    setActions([]);
    setInvoices([]);
    setTickets([]);
    setFeatures([]);
    setDocuments([]);
    setRecoveryLeads([]);
    setDrafts([]);
    setOnboarding({ company: '', name: '', project: '', contract: '', customer: '', step: 0 });
    setSubscription('Non-Aktif');
    setIsLoading(false);
    journeyRef.current = { ...INITIAL_JOURNEY };
    setJourney({ ...INITIAL_JOURNEY });
  }, []);

  // Resolve identity first. Only billing and projects are needed for the next screen.
  const reloadData = useCallback((): Promise<Journey> => {
    if (reloadRequest.current) return reloadRequest.current;
    const version = sessionVersion.current;
    const isCurrent = () => version === sessionVersion.current;
    const request = (async () => {
      setIsLoading(true);
      let identityVerified = false;
      try {
        const me = await api.getMe();
        if (!isCurrent()) throw new Error('Sesi telah berubah. Silakan coba lagi.');
        if (!me?.user || !me.actor) throw new Error('Identitas akun belum dapat dimuat.');
        identityVerified = true;
        const user = me.user;
        const orgId = user.orgId || null;
        const needsTenant = Boolean(me.tenantSelectionRequired);
        if (tenantIdRef.current !== orgId) {
          setProjects([]); setActions([]); setInvoices([]); setTickets([]); setFeatures([]); setDocuments([]);
        }
        tenantIdRef.current = orgId;
        setSelectedTenantId(orgId);
        setActiveOrganizationId(orgId);
        setActor(me.actor);
        setUserName(user.name || '');
        setUserEmail(user.email || '');
        setRoleState(user.role || null);
        setCompany(user.company || '');
        setTenantSelectionRequired(needsTenant);
        setTenantOptions(Array.isArray(me.tenantOptions) ? me.tenantOptions : []);
        setAuthStatus('authenticated');

        let freshProjects: Project[] = [];
        let billing: {status?: string; subscription?: {status?: string; planId?: string} | null} | null = null;
        if (orgId && !needsTenant) {
          billing = await api.getBilling();
          if (!isCurrent()) throw new Error('Sesi telah berubah. Silakan coba lagi.');
          if ((billing?.status || billing?.subscription?.status) === 'ACTIVE') freshProjects = await api.getProjects();
          if (!isCurrent()) throw new Error('Sesi telah berubah. Silakan coba lagi.');
        }
        const billingStatus = String(billing?.status || billing?.subscription?.status || 'NONE').toLowerCase();
        const status: Journey['status'] = ['active', 'pending', 'verifying', 'failed', 'expired'].includes(billingStatus)
          ? billingStatus as Journey['status'] : 'none';
        const account: Journey = {
          ...INITIAL_JOURNEY,
          intent: journeyRef.current.intent,
          signedIn: true,
          companyComplete: Boolean(orgId && user.company),
          status,
          activePlan: parsePlan(billing?.subscription?.planId || null),
          firstProject: freshProjects.length > 0,
          platformAdmin: Boolean(me.actor.isPlatformAdmin),
          tenantSelectionRequired: needsTenant
        };
        setProjects(freshProjects);
        setSubscription(status === 'active' ? 'Aktif' : 'Non-Aktif');
        journeyRef.current = account;
        setJourney(account);

        if (orgId && !needsTenant) {
          // Auxiliary collections must not delay sign-in or cross a logout/tenant change.
          void Promise.allSettled([api.getActions(), api.getInvoices(), api.getTickets(), api.getFeatures()])
            .then(([actionsResult, invoicesResult, ticketsResult, featuresResult]) => {
              if (!isCurrent() || tenantIdRef.current !== orgId) return;
              if (actionsResult.status === 'fulfilled' && Array.isArray(actionsResult.value)) setActions(actionsResult.value);
              if (invoicesResult.status === 'fulfilled' && Array.isArray(invoicesResult.value)) setInvoices(invoicesResult.value);
              if (ticketsResult.status === 'fulfilled' && Array.isArray(ticketsResult.value)) setTickets(ticketsResult.value);
              if (featuresResult.status === 'fulfilled' && Array.isArray(featuresResult.value)) setFeatures(featuresResult.value);
            });
        }
        return account;
      } catch (cause) {
        if (isCurrent()) {
          if (!identityVerified && (cause as {status?: number})?.status === 401) {
            clearTenantSessionState();
            setAuthStatus('unauthenticated');
          }
          setNotice('Akun belum dapat dimuat. Silakan coba lagi.');
        }
        throw Object.assign(new Error('Akun belum dapat dimuat. Silakan coba lagi.', {cause}), {code: 'APP_SESSION_LOAD_FAILED'});
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    })();
    reloadRequest.current = request;
    void request.finally(() => {
      if (reloadRequest.current === request) reloadRequest.current = null;
    }).catch(() => {});
    return request;
  }, [clearTenantSessionState]);

  // Listen to Supabase Auth lifecycle
  useEffect(() => {
    let disposed = false;
    let authChanged = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleReload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!disposed) void reloadData().catch(() => {}); }, 0);
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (disposed || authChanged) return;
      sessionUserId.current = session?.user.id || null;
      if (session?.user) {
        scheduleReload();
      } else {
        setAuthStatus('unauthenticated');
        clearTenantSessionState();
      }
    }).catch(() => { if (!disposed && !authChanged) { setAuthStatus('unauthenticated'); clearTenantSessionState(); } });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      authChanged = true;
      if (session?.user) {
        if (sessionUserId.current && sessionUserId.current !== session.user.id) clearTenantSessionState();
        sessionUserId.current = session.user.id;
        scheduleReload();
      } else {
        // SIGNED_OUT or session expired — clear ALL tenant state to prevent cross-account leakage
        clearTimeout(timer);
        sessionUserId.current = null;
        setAuthStatus('unauthenticated');
        clearTenantSessionState();
      }
    });

    return () => { disposed = true; clearTimeout(timer); subscription.unsubscribe(); };
  }, [reloadData, clearTenantSessionState]);

  // Mutations
  const createProject = async (data: { name: string; code?: string; contract: number; customer: string; location?: string; owner?: string; values?: number[] }) => {
    const newProject = await api.createProject(data);
    setProjects(prev => [...prev, newProject]);
    return newProject;
  };

  const updateProjectStatus = async (id: string, status?: string) => {
    const updated = await api.updateProjectStatus(id, status || '');
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  };

  const createLedgerEntry = async (projectId: string, stageIndex: number, amount: number, reference: string, reason: string) => {
    const updated = await api.createLedgerEntry(projectId, { stageIndex, amount, reference, reason });
    setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
    return updated;
  };

  const createAction = async (data: { projectId: string; title: string; blocker: string; owner?: string; due?: string; severity?: Action['severity']; value?: number }) => {
    const newAction = await api.createAction(data);
    setActions(prev => [newAction, ...prev]);
    return newAction;
  };

  const addActionNote = async (id: string, note: string, resolve = false) => {
    const updated = await api.addActionNote(id, note, resolve);
    setActions(prev => prev.map(a => a.id === id ? updated : a));
    return updated;
  };

  const createInvoice = async (data: { projectId: string; number: string; principal: number; issued?: string; due?: string; certificate: string }) => {
    const newInvoice = await api.createInvoice(data);
    setInvoices(prev => [...prev, newInvoice]);
    try {
      const freshProjects = await api.getProjects();
      if (Array.isArray(freshProjects)) setProjects(freshProjects);
    } catch (e) {
      console.warn(e);
    }
    return newInvoice;
  };

  const recordCashReceipt = async (data: { projectId: string; amount?: number; receivedAmount?: number; bankReference: string; allocations: Array<{ invoiceId: string; amount: number }> }) => {
    const result = await api.recordCashReceipt(data);
    try {
      const [freshInvoices, freshProjects] = await Promise.all([
        api.getInvoices(),
        api.getProjects()
      ]);
      if (Array.isArray(freshInvoices)) setInvoices(freshInvoices);
      if (Array.isArray(freshProjects)) setProjects(freshProjects);
    } catch (e) {
      console.warn(e);
    }
    return result;
  };

  const logout = async () => {
    setAuthStatus('unauthenticated');
    clearTenantSessionState();
    await supabase.auth.signOut();
  };

  const createTicket = async (data: { title: string; body: string; category?: string; priority?: string }) => {
    const newTicket = await api.createTicket(data);
    setTickets(prev => [newTicket, ...prev]);
    return newTicket;
  };

  const addTicketMessage = async (id: string, message: string) => {
    const updated = await api.addTicketMessage(id, message);
    setTickets(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  const createFeature = async (data: { title: string; problem: string; module?: string; commercialImpact?: string }) => {
    const newFeature = await api.createFeature(data);
    setFeatures(prev => [newFeature, ...prev]);
    return newFeature;
  };

  // Pure role permissions (Section S: no null role mutation authority)
  const writeable = !!role && role !== 'AUDITOR' && role !== 'EXECUTIVE_VIEWER' && state !== 'restricted' && state !== 'denied';
  const financial = writeable && !!role && ['OWNER', 'ADMIN', 'FINANCE_MANAGER', 'COVE_IMPLEMENTATION'].includes(role);
  const commercial = writeable && !!role && ['OWNER', 'ADMIN', 'COMMERCIAL_MANAGER', 'QS', 'PROJECT_MANAGER', 'COVE_IMPLEMENTATION'].includes(role);

  const reset = async () => {
    setProjects([]);
    setActions([]);
    setInvoices([]);
    setDocuments([]);
    setTickets([]);
    setFeatures([]);
    setRecoveryLeads([]);
    setDrafts([]);
    setState('normal');
    setNotice('Data aplikasi disinkronkan kembali dari server.');
    await reloadData();
  };

  const draft = (title: string, description: string) => {
    setDrafts(v => [{ title, description, at: new Date().toLocaleTimeString('id-ID') }, ...v]);
    setNotice('Draf tersimpan di riwayat aktivitas.');
  };

  const selectTenant = async (orgId: string) => {
    clearTenantSessionState();
    tenantIdRef.current = orgId;
    setActiveOrganizationId(orgId);
    setSelectedTenantId(orgId);
    setTenantSelectionRequired(false);
    await reloadData();
  };

  return {
    journey,
    setJourney,
    tracking,
    setTracking,
    consentOpen,
    setConsentOpen,
    projects,
    setProjects,
    actions,
    setActions,
    invoices,
    setInvoices,
    documents,
    setDocuments,
    tickets,
    setTickets,
    features,
    setFeatures,
    recoveryLeads,
    setRecoveryLeads,
    authStatus,
    actor,
    userName,
    userEmail,
    role,
    state,
    setState,
    company,
    setCompany,
    selectedTenantId,
    tenantOptions,
    tenantSelectionRequired,
    selectTenant,
    drafts,
    draft,
    notice,
    setNotice,
    subscription,
    setSubscription,
    consents,
    setConsents,
    readNotifications,
    setReadNotifications,
    onboarding,
    setOnboarding,
    writeable,
    financial,
    commercial,
    reset,
    logout,
    clearTenantSessionState,
    isLoading,
    reloadData,
    createProject,
    updateProjectStatus,
    createLedgerEntry,
    createAction,
    addActionNote,
    createInvoice,
    recordCashReceipt,
    createTicket,
    addTicketMessage,
    createFeature
  };
}

type Store = ReturnType<typeof useWorkspaceStore>;
const Context = createContext<Store>(null!);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const store = useWorkspaceStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useStore() {
  return useContext(Context);
}
