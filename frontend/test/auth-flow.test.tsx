// @vitest-environment jsdom
import {beforeEach, afterEach, expect, test, vi} from 'vitest';
import type {ReactNode, AnchorHTMLAttributes} from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {LoginPage, SignupPage, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage} from '@/features/access';
import {INITIAL_JOURNEY, type Journey} from '@/lib/journey';
import {authQuery, rememberAuthEmail} from '@/lib/auth';

type TestStore={journey:Journey;authStatus:'loading'|'authenticated'|'unauthenticated';actor:{id:string}|null;reloadData:ReturnType<typeof vi.fn>;isLoading:boolean;notice:string};
const mocks=vi.hoisted(()=>({
  store:{} as TestStore, query:'', go:vi.fn(), signInWithPassword:vi.fn(), signUp:vi.fn(),
  resend:vi.fn(), getSession:vi.fn(), resetPasswordForEmail:vi.fn(), updateUser:vi.fn()
}));
vi.mock('@/lib/store',()=>({useStore:()=>mocks.store}));
vi.mock('@/lib/api',()=>({api:{}}));
vi.mock('@/lib/supabase',()=>({supabase:{auth:mocks}}));
vi.mock('@/features/public',()=>({PublicFrame:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('@/lib/router',()=>({
  useRoute:()=>({path:'/login',query:new URLSearchParams(mocks.query),go:mocks.go}),
  Link:({children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>
}));

beforeEach(()=>{
  vi.resetAllMocks();sessionStorage.clear();history.replaceState({},'','/');mocks.query='';
  mocks.store={journey:{...INITIAL_JOURNEY},authStatus:'unauthenticated',actor:null,reloadData:vi.fn(),isLoading:false,notice:''};
  mocks.store.reloadData.mockResolvedValue({...INITIAL_JOURNEY,signedIn:true,companyComplete:true,status:'active',activePlan:'core',firstProject:true});
  mocks.signInWithPassword.mockResolvedValue({data:{session:{}},error:null});
  mocks.signUp.mockResolvedValue({data:{session:null},error:null});
  mocks.resend.mockResolvedValue({data:{},error:null});
  mocks.getSession.mockResolvedValue({data:{session:null},error:null});
  mocks.resetPasswordForEmail.mockResolvedValue({data:{},error:null});
  mocks.updateUser.mockResolvedValue({data:{},error:null});
});
afterEach(cleanup);

function fillLogin(password='legacy') {
  fireEvent.change(screen.getByLabelText(/^Email/),{target:{value:'person@example.com'}});
  fireEvent.change(screen.getByLabelText(/^Kata sandi/),{target:{value:password}});
}
function fillSignup() {
  fillLogin('secure-password');
  fireEvent.change(screen.getByLabelText(/Nama lengkap/),{target:{value:'Nama Pengguna'}});
  fireEvent.click(screen.getByRole('checkbox',{name:/Saya menyetujui/}));
}

test('login uses the fresh account and requested page, without imposing signup password rules',async()=>{
  mocks.query='plan=core&returnTo=%2Fprojects';render(<LoginPage/>);fillLogin();
  expect(screen.getByLabelText(/^Kata sandi/).getAttribute('minlength')).toBeNull();
  expect(screen.queryByLabelText('Tahapan berlangganan')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Masuk'}));
  await waitFor(()=>expect(mocks.go).toHaveBeenCalledWith('/projects'));
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({email:'person@example.com',password:'legacy'});
  expect(sessionStorage.getItem('cove_pending_auth_email')).toBeNull();
});

test('password visibility and forgot-password preserve email and navigation intent',()=>{
  mocks.query='plan=core&returnTo=%2Freports';render(<LoginPage/>);fillLogin();
  fireEvent.click(screen.getByRole('checkbox',{name:'Tampilkan kata sandi'}));
  expect(screen.getByLabelText(/^Kata sandi/).getAttribute('type')).toBe('text');
  expect(screen.getByRole('link',{name:'Lupa kata sandi?'}).getAttribute('href')).toBe('/forgot-password?plan=core&returnTo=%2Freports');
  expect(sessionStorage.getItem('cove_pending_auth_email')).toBe('person@example.com');
  expect(sessionStorage.length).toBe(1);
});

test('incorrect credentials show a helpful message without raw provider details',async()=>{
  mocks.signInWithPassword.mockResolvedValue({error:{code:'invalid_credentials',message:'private provider detail'}});
  render(<LoginPage/>);fillLogin();fireEvent.click(screen.getByRole('button',{name:'Masuk'}));
  await screen.findByText(/Email atau kata sandi belum cocok/);
  expect(screen.queryByText(/private provider detail/)).toBeNull();
  expect(mocks.store.reloadData).not.toHaveBeenCalled();expect(mocks.go).not.toHaveBeenCalled();
});

test('unconfirmed email offers verification without granting access',async()=>{
  mocks.signInWithPassword.mockResolvedValue({error:{code:'email_not_confirmed'}});
  mocks.query='plan=core';render(<LoginPage/>);fillLogin();fireEvent.click(screen.getByRole('button',{name:'Masuk'}));
  expect((await screen.findByRole('link',{name:'Buka verifikasi email'})).getAttribute('href')).toBe('/verify-email?plan=core');
  expect(mocks.go).not.toHaveBeenCalled();expect(mocks.store.reloadData).not.toHaveBeenCalled();
});

test('failed account load can be retried without submitting credentials again',async()=>{
  mocks.store.reloadData.mockRejectedValueOnce({code:'APP_SESSION_LOAD_FAILED'});
  render(<LoginPage/>);fillLogin();fireEvent.click(screen.getByRole('button',{name:'Masuk'}));
  fireEvent.click(await screen.findByRole('button',{name:'Coba muat akun lagi'}));
  await waitFor(()=>expect(mocks.go).toHaveBeenCalledWith('/dashboard'));
  expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);
});

test('a failed refresh cannot silently redirect using an old active account',async()=>{
  mocks.store.reloadData.mockImplementation(async()=>{
    mocks.store.authStatus='authenticated';mocks.store.actor={id:'u1'};
    mocks.store.journey={...INITIAL_JOURNEY,signedIn:true,companyComplete:true,status:'active',firstProject:true};
    throw {code:'APP_SESSION_LOAD_FAILED'};
  });
  render(<LoginPage/>);fillLogin();fireEvent.click(screen.getByRole('button',{name:'Masuk'}));
  await screen.findByRole('button',{name:'Coba muat akun lagi'});
  expect(mocks.go).not.toHaveBeenCalled();
});

test('restored session with a failed account load shows a retry without requesting credentials',async()=>{
  mocks.store.authStatus='authenticated';mocks.store.actor={id:'u1'};mocks.store.notice='Akun belum dapat dimuat. Silakan coba lagi.';
  render(<LoginPage/>);fireEvent.click(screen.getByRole('button',{name:'Coba muat akun lagi'}));
  await waitFor(()=>expect(mocks.go).toHaveBeenCalledWith('/dashboard'));
  expect(mocks.signInWithPassword).not.toHaveBeenCalled();
});

test('signup without a session goes to real email verification with a safe callback',async()=>{
  mocks.query='plan=core&returnTo=%2Freports';render(<SignupPage/>);fillSignup();
  fireEvent.click(screen.getByRole('button',{name:'Buat akun'}));
  await waitFor(()=>expect(mocks.go).toHaveBeenCalledWith('/verify-email?plan=core&returnTo=%2Freports'));
  expect(mocks.signUp).toHaveBeenCalledWith({email:'person@example.com',password:'secure-password',options:{data:{full_name:'Nama Pengguna'},emailRedirectTo:location.origin+'/verify-email?plan=core&returnTo=%2Freports'}});
  expect(mocks.store.reloadData).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('cove_pending_auth_email')).toBe('person@example.com');
});

test('signup with a real session uses the returned account state',async()=>{
  mocks.signUp.mockResolvedValue({data:{session:{user:{id:'u1'}}},error:null});
  mocks.store.reloadData.mockResolvedValue({...INITIAL_JOURNEY,signedIn:true});
  mocks.query='plan=core';render(<SignupPage/>);fillSignup();fireEvent.click(screen.getByRole('button',{name:'Buat akun'}));
  await waitFor(()=>expect(mocks.go).toHaveBeenCalledWith('/onboarding?plan=core'));
});

test('resend contacts Supabase and prevents repeated requests during cooldown',async()=>{
  rememberAuthEmail('person@example.com');mocks.query='plan=core';render(<VerifyEmailPage/>);
  fireEvent.click(screen.getByRole('button',{name:'Kirim ulang email verifikasi'}));
  await screen.findByText(/Permintaan terkirim/);
  expect(mocks.resend).toHaveBeenCalledWith({type:'signup',email:'person@example.com',options:{emailRedirectTo:location.origin+'/verify-email?plan=core'}});
  const resend=screen.getByRole('button',{name:/Kirim ulang dalam/}) as HTMLButtonElement;
  expect(resend.disabled).toBe(true);fireEvent.click(resend);expect(mocks.resend).toHaveBeenCalledTimes(1);
});

test('failed resend displays an error and never reports email sent',async()=>{
  mocks.resend.mockResolvedValue({error:{code:'over_email_send_rate_limit',status:429}});
  rememberAuthEmail('person@example.com');render(<VerifyEmailPage/>);
  fireEvent.click(screen.getByRole('button',{name:'Kirim ulang email verifikasi'}));
  await screen.findByText(/Terlalu banyak permintaan/);
  expect(screen.queryByText(/Permintaan terkirim/)).toBeNull();expect(mocks.go).not.toHaveBeenCalled();
});

test('verification click and URL flags cannot authenticate an absent session',async()=>{
  mocks.query='verified=true&status=paid';render(<VerifyEmailPage/>);
  fireEvent.click(screen.getByRole('button',{name:/Saya sudah verifikasi/}));
  await screen.findByText(/jika verifikasi dibuka di perangkat atau browser lain/);
  expect(mocks.store.reloadData).not.toHaveBeenCalled();expect(mocks.go).not.toHaveBeenCalled();
});

test('verification with a real session resumes the server account',async()=>{
  mocks.getSession.mockResolvedValue({data:{session:{user:{id:'u1'}}},error:null});
  mocks.query='returnTo=%2Freports';render(<VerifyEmailPage/>);
  fireEvent.click(screen.getByRole('button',{name:/Saya sudah verifikasi/}));
  await waitFor(()=>expect(mocks.go).toHaveBeenCalledWith('/reports'));
  expect(mocks.store.reloadData).toHaveBeenCalledTimes(1);
});

test('password recovery reports returned provider errors instead of success',async()=>{
  mocks.query='returnTo=%2Freports';mocks.resetPasswordForEmail.mockResolvedValue({error:{status:500,message:'SMTP secret detail'}});
  render(<ForgotPasswordPage/>);fireEvent.change(screen.getByLabelText(/^Email/),{target:{value:'person@example.com'}});
  fireEvent.click(screen.getByRole('button',{name:'Minta tautan pemulihan'}));
  await screen.findByText(/Layanan akun sedang mengalami kendala/);
  expect(screen.queryByText(/Jika akun terdaftar/)).toBeNull();
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('person@example.com',{redirectTo:location.origin+'/reset-password?returnTo=%2Freports'});
});

test('password reset waits for a session and rejects an absent session',async()=>{
  let resolveSession!: (value:{data:{session:null};error:null})=>void;
  mocks.getSession.mockReturnValue(new Promise(resolve=>{resolveSession=resolve;}));render(<ResetPasswordPage/>);
  expect(screen.getByRole('heading',{name:'Memeriksa tautan pemulihan'})).toBeTruthy();
  expect(screen.queryByLabelText(/Kata sandi baru/)).toBeNull();
  resolveSession({data:{session:null},error:null});
  await screen.findByRole('heading',{name:'Sesi pemulihan tidak valid'});
  expect(mocks.updateUser).not.toHaveBeenCalled();
});

test('reset updates a real session only when passwords match',async()=>{
  mocks.getSession.mockResolvedValue({data:{session:{user:{id:'u1'}}},error:null});render(<ResetPasswordPage/>);
  fireEvent.change(await screen.findByLabelText(/^Kata sandi baru/),{target:{value:'new-password'}});
  fireEvent.change(screen.getByLabelText(/^Ulangi kata sandi baru/),{target:{value:'different-password'}});
  fireEvent.click(screen.getByRole('button',{name:/Perbarui Kata Sandi/}));
  await screen.findByText('Konfirmasi kata sandi tidak cocok.');expect(mocks.updateUser).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Ulangi kata sandi baru/),{target:{value:'new-password'}});
  fireEvent.click(screen.getByRole('button',{name:/Perbarui Kata Sandi/}));
  await screen.findByRole('heading',{name:'Kata sandi berhasil diperbarui'});
  expect(mocks.updateUser).toHaveBeenCalledWith({password:'new-password'});
});

test('external and encoded redirect targets are removed from auth links',()=>{
  expect(authQuery('core','https://evil.example')).toBe('?plan=core');
  expect(authQuery(null,'//evil.example')).toBe('');
  expect(authQuery(null,'/projects%2F..%2F..')).toBe('');
});
