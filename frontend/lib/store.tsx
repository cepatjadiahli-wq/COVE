// ============================================================================
// COVE Frontend — Workspace State Store (Gate P0-A)
// Integrates with Supabase Auth, eliminates privilege escalation switch-role.
// ============================================================================

import {createContext, useContext, useEffect, useState, useCallback, type ReactNode} from 'react';
import type {
  Project,
  Action,
  Invoice,
  DocumentRecord,
  Ticket,
  Feature,
  RecoveryLead
} from './domain';
import { INITIAL_JOURNEY, type Journey } from './journey';
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

  useEffect(() => saveConsent(consents), [consents]);

  // Fetch initial data from backend on mount / auth change
  const reloadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [meRes, projRes, actRes, invRes, tktRes, featRes, billRes] = await Promise.allSettled([
        api.getMe(),
        api.getProjects(),
        api.getActions(),
        api.getInvoices(),
        api.getTickets(),
        api.getFeatures(),
        api.getBilling()
      ]);

      if (meRes.status === 'fulfilled' && meRes.value?.user) {
        const user = meRes.value.user;
        setActor(meRes.value.actor || null);
        setUserName(user.name || '');
        setUserEmail(user.email || '');
        setRoleState(user.role || null);
        setCompany(user.company || '');
        setTenantSelectionRequired(Boolean(meRes.value.tenantSelectionRequired));
        if (Array.isArray(meRes.value.tenantOptions)) {
          setTenantOptions(meRes.value.tenantOptions);
        }
        if (user.orgId) {
          setSelectedTenantId(user.orgId);
          setActiveOrganizationId(user.orgId);
        }
        setAuthStatus('authenticated');
        setJourney(j => ({
          ...j,
          signedIn: true,
          companyComplete: !!user.company,
          status: billRes.status === 'fulfilled' && billRes.value?.subscription?.status === 'ACTIVE' ? 'active' : j.status
        }));
      } else if (meRes.status === 'rejected') {
        // If 401/403 and no actor
        setAuthStatus('unauthenticated');
        setActor(null);
        setRoleState(null);
        setCompany('');
        setTenantOptions([]);
        setTenantSelectionRequired(false);
      }

      if (projRes.status === 'fulfilled' && Array.isArray(projRes.value)) {
        setProjects(projRes.value);
      }
      if (actRes.status === 'fulfilled' && Array.isArray(actRes.value)) {
        setActions(actRes.value);
      }
      if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) {
        setInvoices(invRes.value);
      }
      if (tktRes.status === 'fulfilled' && Array.isArray(tktRes.value)) {
        setTickets(tktRes.value);
      }
      if (featRes.status === 'fulfilled' && Array.isArray(featRes.value)) {
        setFeatures(featRes.value);
      }
      if (billRes.status === 'fulfilled' && billRes.value?.subscription) {
        setSubscription(billRes.value.subscription.status === 'ACTIVE' ? 'Aktif' : 'Non-Aktif');
      }
    } catch (err) {
      console.warn('Backend sync error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clears all tenant-scoped session state. Called on logout and SIGNED_OUT auth event.
   * Prevents stale tenant context leaking across accounts.
   */
  const clearTenantSessionState = useCallback(() => {
    setActor(null);
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
    setSubscription('Non-Aktif');
    setJourney({ ...INITIAL_JOURNEY });
  }, []);

  // Listen to Supabase Auth lifecycle
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthStatus('authenticated');
        reloadData();
      } else {
        // Probe backend in case session cookie or test header exists
        api.getMe()
          .then(data => {
            if (data?.user) {
              setActor(data.actor || null);
              setUserName(data.user.name || '');
              setUserEmail(data.user.email || '');
              setRoleState(data.user.role || null);
              setCompany(data.user.company || '');
              setAuthStatus('authenticated');
              reloadData();
            } else {
              setAuthStatus('unauthenticated');
              setRoleState(null);
              setActor(null);
              setCompany('');
            }
          })
          .catch(() => {
            setAuthStatus('unauthenticated');
            setRoleState(null);
            setActor(null);
            setCompany('');
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthStatus('authenticated');
        reloadData();
      } else {
        // SIGNED_OUT or session expired — clear ALL tenant state to prevent cross-account leakage
        setAuthStatus('unauthenticated');
        clearTenantSessionState();
      }
    });

    return () => subscription.unsubscribe();
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
    await supabase.auth.signOut();
    setAuthStatus('unauthenticated');
    clearTenantSessionState();
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
