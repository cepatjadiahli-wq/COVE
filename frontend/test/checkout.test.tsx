// @vitest-environment jsdom
import {beforeEach, afterEach, expect, test, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {INITIAL_JOURNEY} from '@/lib/journey';
import {CheckoutPage, OnboardingCompanyPage, PaymentStatusPage} from '@/features/access';

const mocks = vi.hoisted(() => ({
  store: {} as any,
  updateProfile: vi.fn(), createCheckout: vi.fn(), createOrganization: vi.fn(), getBilling: vi.fn(), go: vi.fn()
}));
vi.mock('@/lib/store', () => ({useStore:() => mocks.store}));
vi.mock('@/lib/api', () => ({api:mocks}));
vi.mock('@/lib/supabase', () => ({supabase:{auth:{}}}));
vi.mock('@/features/public', () => ({PublicFrame:({children}:any) => <div>{children}</div>}));
vi.mock('@/lib/router', () => ({
  useRoute:() => ({path:'/checkout', query:new URLSearchParams('plan=core&status=paid'), go:mocks.go}),
  Link:({children, ...props}:any) => <a {...props}>{children}</a>
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.store = {
    actor:{phone:null}, company:'PT Test', authStatus:'authenticated',
    journey:{...INITIAL_JOURNEY, signedIn:true, companyComplete:true},
    onboarding:{company:''}, reloadData:vi.fn().mockResolvedValue(undefined)
  };
  mocks.updateProfile.mockResolvedValue({phone:'081234567890'});
  mocks.createCheckout.mockRejectedValue(new Error('Gateway sedang tidak tersedia.'));
  mocks.getBilling.mockResolvedValue({status:'NONE', subscription:null});
});
afterEach(cleanup);

test('existing company can save a missing phone at checkout before contacting payment provider', async () => {
  render(<CheckoutPage/>);
  fireEvent.change(screen.getByLabelText(/Nomor HP penanggung jawab/), {target:{value:'081234567890'}});
  fireEvent.click(screen.getByRole('button', {name:/Lanjutkan ke Pembayaran/}));
  await screen.findByText('Gateway sedang tidak tersedia.');
  expect(mocks.updateProfile).toHaveBeenCalledWith({phone:'081234567890'});
  expect(mocks.createCheckout).toHaveBeenCalledWith('core');
  expect(mocks.updateProfile.mock.invocationCallOrder[0]).toBeLessThan(mocks.createCheckout.mock.invocationCallOrder[0]);
});

test('invalid phone and failed profile save both prevent checkout', async () => {
  render(<CheckoutPage/>);
  fireEvent.click(screen.getByRole('button', {name:/Lanjutkan ke Pembayaran/}));
  expect(mocks.createCheckout).not.toHaveBeenCalled();
  mocks.updateProfile.mockRejectedValue(new Error('Profil gagal disimpan.'));
  fireEvent.change(screen.getByLabelText(/Nomor HP penanggung jawab/), {target:{value:'081234567890'}});
  fireEvent.click(screen.getByRole('button', {name:/Lanjutkan ke Pembayaran/}));
  await screen.findByText('Profil gagal disimpan.');
  expect(mocks.createCheckout).not.toHaveBeenCalled();
});

test('phone save failure during onboarding does not create an organization', async () => {
  mocks.store.company = '';
  mocks.updateProfile.mockRejectedValue(new Error('Profil gagal disimpan.'));
  render(<OnboardingCompanyPage/>);
  fireEvent.change(screen.getByLabelText(/Nama legal perusahaan/), {target:{value:'PT Baru'}});
  fireEvent.change(screen.getByLabelText(/Alamat perusahaan/), {target:{value:'Jakarta'}});
  fireEvent.change(screen.getByLabelText(/Nomor HP \/ WhatsApp penanggung jawab/), {target:{value:'081234567890'}});
  fireEvent.click(screen.getByRole('button', {name:/Simpan & Lanjut/}));
  await screen.findByText('Profil gagal disimpan.');
  expect(mocks.createOrganization).not.toHaveBeenCalled();
});

test('a paid URL parameter cannot activate access without server billing confirmation', async () => {
  render(<PaymentStatusPage/>);
  await waitFor(() => expect(mocks.getBilling).toHaveBeenCalled());
  expect(screen.queryByText(/Aktif — Entitlement Terverifikasi/)).toBeNull();
  expect(screen.getByRole('heading', {name:'Status belum tersedia'})).toBeTruthy();
});
