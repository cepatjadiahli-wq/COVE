import {expect, test} from 'vitest';
import {afterAccess, INITIAL_JOURNEY, type Journey} from '@/lib/journey';

const active: Journey = {...INITIAL_JOURNEY, signedIn:true, companyComplete:true, status:'active', activePlan:'core', firstProject:true};

test('returning customers continue their workspace with the same plan and a safe destination', () => {
  expect(afterAccess(active, 'core')).toBe('/dashboard');
  expect(afterAccess(active, 'core', '/projects/project-1')).toBe('/projects/project-1');
  expect(afterAccess(active, 'scale', '/invoices')).toBe('/invoices');
  expect(afterAccess(active, null, '//evil.example')).toBe('/dashboard');
});

test('verified account state selects setup, payment recovery or plan changes', () => {
  expect(afterAccess({...active, firstProject:false}, 'core')).toBe('/onboarding/project');
  expect(afterAccess(active, 'scale')).toBe('/billing?change=scale');
  expect(afterAccess({...active, status:'pending'}, 'core')).toBe('/billing/status');
  expect(afterAccess({...active, status:'expired'}, 'core')).toBe('/checkout?plan=core');
  expect(afterAccess({...INITIAL_JOURNEY, signedIn:true}, 'core')).toBe('/onboarding?plan=core');
});

test('tenant selection and platform administration do not start another purchase', () => {
  expect(afterAccess({...INITIAL_JOURNEY, signedIn:true, tenantSelectionRequired:true}, 'core')).toBe('/dashboard');
  expect(afterAccess({...INITIAL_JOURNEY, signedIn:true, platformAdmin:true}, 'core')).toBe('/admin');
});
