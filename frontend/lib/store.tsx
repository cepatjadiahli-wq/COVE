// ============================================================================
// COVE Frontend — Workspace State Store (Gate P0-A)
// Integrates with Supabase Auth, eliminates privilege escalation switch-role.
// ============================================================================

import {createContext, useContext, useEffect, useState, useCallback, type ReactNode} from 'react';
import {
  projectsSeed,
  actionsSeed,
  invoicesSeed,
  documentsSeed,
  ticketsSeed,
  featuresSeed,
  recoveryLeadsSeed,
  type Project,
  type Action,
  type Invoice,
  type DocumentRecord,
  type Ticket,
  type Feature,
  type RecoveryLead
} from './domain';
import { INITIAL_JOURNEY, type Journey } from './journey';
import { readConsent, saveConsent } from './privacy';
import { api } from './api';
import { supabase } from './supabase';

export type PreviewRole =
  | 'OWNER'
  | 'ADMIN'
  | 'COMMERCIAL_MANAGER'
  | 'QS'
  | 'PROJECT_MANAGER'
  | 'FINANCE_MANAGER'
  | 'EXECUTIVE_VIEWER'
  | 'AUDITOR'
  | 'COVE_IMPLEMENTATION';

export type PreviewState = 'normal' | 'empty' | 'loading' | 'error' | 'denied' | 'restricted' | 'stale' | 'conflict';
export type Draft = { title: string; description: string; at: string };

function useSeed<T>(seed: T) {
  return useState<T>(() => structuredClone(seed));
}

function useWorkspaceStore() {
  const [journey, setJourney] = useState<Journey>({ ...INITIAL_JOURNEY });
  const [tracking, setTracking] = useState({ enabled: false, verified: false, pixelId: '' });
  const [consentOpen, setConsentOpen] = useState(false);
  const exitPreview = () => setJourney({ ...INITIAL_JOURNEY });

  const [projects, setProjects] = useSeed<Project[]>(projectsSeed);
  const [actions, setActions] = useSeed<Action[]>(actionsSeed);
  const [invoices, setInvoices] = useSeed<Invoice[]>(invoicesSeed);
  const [documents, setDocuments] = useSeed<DocumentRecord[]>(documentsSeed);
  const [tickets, setTickets] = useSeed<Ticket[]>(ticketsSeed);
  const [features, setFeatures] = useSeed<Feature[]>(featuresSeed);
  const [recoveryLeads, setRecoveryLeads] = useSeed<RecoveryLead[]>(recoveryLeadsSeed);

  // Authentication & Actor State (PRD v2.2)
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [actor, setActor] = useState<any | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [role, setRoleState] = useState<PreviewRole>('OWNER');
  const [company, setCompany] = useState('PT Ruang Karya Konstruksi');

  const [state, setState] = useState<PreviewState>('normal');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState('');
  const [subscription, setSubscription] = useState('Aktif');
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
        setRoleState(user.role || 'OWNER');
        if (user.company) setCompany(user.company);
        setAuthStatus('authenticated');
      } else if (meRes.status === 'rejected') {
        // If 401/403 and no actor
        setAuthStatus('unauthenticated');
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
  }, [setProjects, setActions, setInvoices, setTickets, setFeatures]);

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
              setRoleState(data.user.role || 'OWNER');
              if (data.user.company) setCompany(data.user.company);
              setAuthStatus('authenticated');
              reloadData();
            } else {
              setAuthStatus('unauthenticated');
            }
          })
          .catch(() => setAuthStatus('unauthenticated'));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthStatus('authenticated');
        reloadData();
      } else {
        setAuthStatus('unauthenticated');
        setActor(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [reloadData]);

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
    setActor(null);
    setAuthStatus('unauthenticated');
    setProjects([]);
    setActions([]);
    setInvoices([]);
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

  // Pure role permissions
  const writeable = role !== 'AUDITOR' && role !== 'EXECUTIVE_VIEWER' && state !== 'restricted' && state !== 'denied';
  const financial = writeable && ['OWNER', 'ADMIN', 'FINANCE_MANAGER', 'COVE_IMPLEMENTATION'].includes(role);
  const commercial = writeable && ['OWNER', 'ADMIN', 'COMMERCIAL_MANAGER', 'QS', 'PROJECT_MANAGER', 'COVE_IMPLEMENTATION'].includes(role);

  const reset = async () => {
    setProjects(structuredClone(projectsSeed));
    setActions(structuredClone(actionsSeed));
    setInvoices(structuredClone(invoicesSeed));
    setDocuments(structuredClone(documentsSeed));
    setTickets(structuredClone(ticketsSeed));
    setFeatures(structuredClone(featuresSeed));
    setRecoveryLeads(structuredClone(recoveryLeadsSeed));
    setDrafts([]);
    setState('normal');
    setNotice('Data aplikasi telah dikembalikan ke kondisi awal.');
    await reloadData();
  };

  const draft = (title: string, description: string) => {
    setDrafts(v => [{ title, description, at: new Date().toLocaleTimeString('id-ID') }, ...v]);
    setNotice('Draf tersimpan di riwayat aktivitas.');
  };

  return {
    journey,
    setJourney,
    exitPreview,
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
    setRole: setRoleState,
    state,
    setState,
    company,
    setCompany,
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
