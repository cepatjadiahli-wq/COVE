// @vitest-environment jsdom
import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import {act, cleanup, render, waitFor} from '@testing-library/react';
import {useEffect} from 'react';
import {PreviewProvider, useStore} from '@/lib/store';
import {afterAccess, INITIAL_JOURNEY} from '@/lib/journey';

type AuthListener = (event:string, session:{user:{id:string}} | null) => unknown;

const mocks = vi.hoisted(() => ({
  getMe:vi.fn(), getProjects:vi.fn(), getBilling:vi.fn(), getActions:vi.fn(),
  getInvoices:vi.fn(), getTickets:vi.fn(), getFeatures:vi.fn(),
  setActiveOrganizationId:vi.fn(), getSession:vi.fn(), signOut:vi.fn(),
  authListener:null as null | AuthListener
}));
vi.mock('@/lib/api', () => ({api:mocks, setActiveOrganizationId:mocks.setActiveOrganizationId}));
vi.mock('@/lib/supabase', () => ({supabase:{auth:{
  getSession:mocks.getSession, signOut:mocks.signOut,
  onAuthStateChange:(listener:AuthListener) => {mocks.authListener=listener; return {data:{subscription:{unsubscribe:vi.fn()}}};}
}}}));

let store: ReturnType<typeof useStore>;
function Probe() { const value=useStore(); useEffect(() => {store=value;}, [value]); return null; }
const identity = (orgId:string|null='org-1', platformAdmin=false) => ({
  actor:{id:'profile-1', orgId, isPlatformAdmin:platformAdmin},
  user:{id:'profile-1', name:'COVE User', email:'user@example.test', orgId, company:orgId?'PT COVE':'', role:orgId?'OWNER':null},
  tenantSelectionRequired:false, tenantOptions:[]
});
function deferred<T>() {
  let resolve!: (value:T) => void;
  let reject!: (reason:unknown) => void;
  const promise=new Promise<T>((done, fail) => {resolve=done; reject=fail;});
  return {promise, resolve, reject};
}
async function mountStore() {
  render(<PreviewProvider><Probe/></PreviewProvider>);
  await waitFor(() => expect(store.authStatus).toBe('unauthenticated'));
}
async function reload() {
  let account!: Awaited<ReturnType<typeof store.reloadData>>;
  await act(async () => {account=await store.reloadData();});
  return account;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('localStorage', {getItem:vi.fn().mockReturnValue(null), setItem:vi.fn(), removeItem:vi.fn()});
  mocks.authListener=null;
  mocks.getSession.mockResolvedValue({data:{session:null}});
  mocks.signOut.mockResolvedValue({error:null});
  mocks.getMe.mockResolvedValue(identity());
  mocks.getProjects.mockResolvedValue([{id:'project-1', name:'Project'}]);
  mocks.getBilling.mockResolvedValue({status:'ACTIVE', subscription:{status:'ACTIVE', planId:'core'}});
  for (const method of [mocks.getActions, mocks.getInvoices, mocks.getTickets, mocks.getFeatures]) method.mockResolvedValue([]);
});
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

test('reload returns fresh server-derived routing before auxiliary collections finish', async () => {
  await mountStore();
  const slow=deferred<Array<{id:string}>>();
  mocks.getActions.mockReturnValue(slow.promise);
  const account=await reload();
  expect(account).toMatchObject({signedIn:true, status:'active', activePlan:'core', firstProject:true, companyComplete:true});
  expect(afterAccess(account, 'core', '/projects/project-1')).toBe('/projects/project-1');
  expect(store.journey).toEqual(account);
  await act(async () => {slow.resolve([]);});
});

test('expired entitlement replaces stale active status and preserves plan intent', async () => {
  await mountStore();
  await reload();
  act(() => store.setJourney(j => ({...j, intent:'scale'})));
  mocks.getBilling.mockResolvedValue({status:'EXPIRED', subscription:{status:'EXPIRED', planId:'core'}});
  mocks.getProjects.mockResolvedValue([]);
  const account=await reload();
  expect(account).toMatchObject({status:'expired', activePlan:'core', firstProject:false, intent:'scale'});
  expect(store.subscription).toBe('Non-Aktif');
  expect(afterAccess(account, 'core')).toBe('/checkout?plan=core');
});

test('multiple organizations open selection without tenant requests or forced purchase', async () => {
  await mountStore();
  mocks.getMe.mockResolvedValue({...identity(null), tenantSelectionRequired:true, tenantOptions:[{orgId:'org-1'}, {orgId:'org-2'}]});
  const account=await reload();
  expect(afterAccess(account, 'core')).toBe('/dashboard');
  expect(store.tenantSelectionRequired).toBe(true);
  expect(mocks.getBilling).not.toHaveBeenCalled();
  expect(mocks.getProjects).not.toHaveBeenCalled();
});

test('platform administrator without a tenant opens the admin console', async () => {
  await mountStore();
  mocks.getMe.mockResolvedValue(identity(null, true));
  expect(afterAccess(await reload(), 'core')).toBe('/admin');
  expect(store.actor.isPlatformAdmin).toBe(true);
  expect(mocks.getBilling).not.toHaveBeenCalled();
});

test('a new organization can continue checkout without a subscription or project access', async () => {
  await mountStore();
  mocks.getBilling.mockResolvedValue({status:'NONE', subscription:null});
  mocks.getProjects.mockRejectedValue(Object.assign(new Error('No entitlement'), {status:403}));
  expect(afterAccess(await reload(), 'core')).toBe('/checkout?plan=core');
  expect(mocks.getProjects).not.toHaveBeenCalled();
  expect(store.authStatus).toBe('authenticated');
});

test('billing access failure does not sign out a verified identity or guess a purchase route', async () => {
  await mountStore();
  mocks.getBilling.mockRejectedValue(Object.assign(new Error('Forbidden'), {status:403}));
  await act(async () => {await expect(store.reloadData()).rejects.toMatchObject({code:'APP_SESSION_LOAD_FAILED'});});
  expect(store.authStatus).toBe('authenticated');
  expect(store.actor.orgId).toBe('org-1');
  expect(store.journey.signedIn).toBe(false);
  expect(store.isLoading).toBe(false);
});

test('backend identity failure rejects with an actionable code and preserves a valid session', async () => {
  await mountStore();
  await reload();
  mocks.getMe.mockRejectedValue(Object.assign(new Error('Unavailable'), {status:500}));
  await act(async () => {await expect(store.reloadData()).rejects.toMatchObject({code:'APP_SESSION_LOAD_FAILED'});});
  expect(store.authStatus).toBe('authenticated');
  expect(store.actor.orgId).toBe('org-1');
  expect(store.notice).toContain('coba lagi');
});

test('restored-session backend failure ends loading work and supplies a retry notice', async () => {
  mocks.getSession.mockResolvedValue({data:{session:{user:{id:'user-1'}}}});
  mocks.getMe.mockRejectedValue(Object.assign(new Error('Unavailable'), {status:500}));
  render(<PreviewProvider><Probe/></PreviewProvider>);
  await waitFor(() => expect(store.notice).toContain('coba lagi'));
  expect(store.authStatus).toBe('loading');
  expect(store.isLoading).toBe(false);
  expect(store.journey.signedIn).toBe(false);
});

test('failed billing refresh rejects instead of returning stale active routing state', async () => {
  await mountStore();
  const previous=await reload();
  mocks.getBilling.mockRejectedValue(Object.assign(new Error('Unavailable'), {status:500}));
  await act(async () => {await expect(store.reloadData()).rejects.toMatchObject({code:'APP_SESSION_LOAD_FAILED'});});
  expect(store.authStatus).toBe('authenticated');
  expect(store.journey).toEqual(previous);
  expect(store.notice).toContain('coba lagi');
});

test('an expired identity response clears the previous verified account', async () => {
  await mountStore();
  await reload();
  mocks.getMe.mockRejectedValue(Object.assign(new Error('Expired'), {status:401}));
  await act(async () => {await expect(store.reloadData()).rejects.toMatchObject({code:'APP_SESSION_LOAD_FAILED'});});
  expect(store.authStatus).toBe('unauthenticated');
  expect(store.actor).toBeNull();
  expect(store.journey).toEqual(INITIAL_JOURNEY);
});

test('auth callback defers backend work until outside the Supabase callback', async () => {
  await mountStore();
  let callbackResult: unknown;
  act(() => {callbackResult=mocks.authListener?.('SIGNED_IN', {user:{id:'user-1'}});});
  expect(callbackResult).toBeUndefined();
  expect(mocks.getMe).not.toHaveBeenCalled();
  await waitFor(() => expect(store.journey.signedIn).toBe(true));
});

test('late startup session failure cannot clear a newer signed-in account', async () => {
  const startup=deferred<unknown>();
  mocks.getSession.mockReturnValue(startup.promise);
  render(<PreviewProvider><Probe/></PreviewProvider>);
  act(() => {mocks.authListener?.('SIGNED_IN', {user:{id:'user-1'}});});
  await waitFor(() => expect(store.journey.signedIn).toBe(true));
  await act(async () => {startup.reject(new Error('Startup session failed'));});
  expect(store.authStatus).toBe('authenticated');
  expect(store.actor.orgId).toBe('org-1');
  expect(store.journey.signedIn).toBe(true);
});

test('logout invalidates an identity response still in flight', async () => {
  await mountStore();
  const pending=deferred<ReturnType<typeof identity>>();
  mocks.getMe.mockReturnValue(pending.promise);
  let loading!: Promise<unknown>;
  act(() => {loading=store.reloadData().catch(error => error);});
  await act(async () => {await store.logout();});
  await act(async () => {pending.resolve(identity()); await loading;});
  expect(store.authStatus).toBe('unauthenticated');
  expect(store.actor).toBeNull();
  expect(store.selectedTenantId).toBeNull();
  expect(store.journey).toEqual(INITIAL_JOURNEY);
  expect(store.projects).toEqual([]);
  expect(mocks.getProjects).not.toHaveBeenCalled();
});

test('session expiry clears tenant state and ignores late auxiliary results', async () => {
  await mountStore();
  const slow=deferred<Array<{id:string}>>();
  mocks.getActions.mockReturnValue(slow.promise);
  await reload();
  act(() => {mocks.authListener?.('SIGNED_OUT', null);});
  await act(async () => {slow.resolve([{id:'old-action'}]);});
  expect(store.authStatus).toBe('unauthenticated');
  expect(store.userEmail).toBe('');
  expect(store.actions).toEqual([]);
  expect(store.journey).toEqual(INITIAL_JOURNEY);
  expect(mocks.setActiveOrganizationId).toHaveBeenLastCalledWith(null);
});

test('tenant switching ignores auxiliary responses from the previous organization', async () => {
  await mountStore();
  const slow=deferred<Array<{id:string}>>();
  mocks.getActions.mockReturnValueOnce(slow.promise).mockResolvedValue([{id:'new-action'}]);
  await reload();
  mocks.getMe.mockResolvedValue(identity('org-2'));
  await act(async () => {await store.selectTenant('org-2');});
  await act(async () => {slow.resolve([{id:'old-action'}]);});
  expect(store.actor.orgId).toBe('org-2');
  expect(store.actions).toEqual([{id:'new-action'}]);
});
