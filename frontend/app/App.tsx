import {useRoute} from '@/lib/router';
import {WorkspaceShell} from '@/components/cove/shell';
import {useStore} from '@/lib/store';

// Public Pages
import {
  HomePage,
  HowItWorksPage,
  PricingPage,
  HelpPage,
  PrivacyPolicyPage,
  TermsOfServicePage
} from '@/features/public';

// Access & Auth Pages
import {
  LoginPage,
  SignupPage,
  VerifyEmailPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  OnboardingCompanyPage,
  CheckoutPage,
  PaymentStatusPage,
  OnboardingProjectPage,
  InvitationPage,
  AccessRequired
} from '@/features/access';

// Workspace Features
import {Dashboard} from '@/features/dashboard';
import {ProjectList,ActionList,InvoiceList} from '@/features/operations';
import {ProjectDetail} from '@/features/project';
import {ReportsView} from '@/features/reports';
import {
  BillingView,
  CompanySettingsView,
  TeamSettingsView,
  ProfileView,
  SupportView
} from '@/features/settings';

// Admin Features
import {
  AdminOverview,
  AdminBilling,
  AdminRecovery,
  AdminSupport,
  AdminFeatures,
  AdminSettings
} from '@/features/admin';

export default function App() {
  const {path} = useRoute();
  const s = useStore();

  // Public Marketing & Auth routes
  if (path === '/' || path === '') return <HomePage />;
  if (path === '/cara-kerja') return <HowItWorksPage />;
  if (path === '/pricing') return <PricingPage />;
  if (path === '/bantuan') return <HelpPage />;
  if (path === '/privasi') return <PrivacyPolicyPage />;
  if (path === '/ketentuan') return <TermsOfServicePage />;
  if (path === '/login') return <LoginPage />;
  if (path === '/signup') return <SignupPage />;
  if (path === '/verify-email') return <VerifyEmailPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  if (path === '/onboarding') return <OnboardingCompanyPage />;
  if (path === '/checkout') return <CheckoutPage />;
  if (path === '/payment/status' || path === '/billing/status') return <PaymentStatusPage />;
  if (path === '/onboarding/project') return <OnboardingProjectPage />;
  if (path === '/invitation') return <InvitationPage />;

  // Admin Console Routes (Protected: Requires Platform Administrator Grant)
  if (path.startsWith('/admin')) {
    if (s.authStatus === 'loading') {
      return (
        <main className="marketing" style={{display:'grid',placeItems:'center',minHeight:'100vh',textAlign:'center'}}>
          <p style={{color:'#888'}}>Memverifikasi hak akses platform administrator…</p>
        </main>
      );
    }
    if (s.authStatus === 'unauthenticated' || !s.actor?.isPlatformAdmin) {
      return <AccessRequired admin={true} />;
    }
    return (
      <WorkspaceShell admin>
        {path === '/admin' && <AdminOverview />}
        {path === '/admin/billing' && <AdminBilling />}
        {path === '/admin/recovery' && <AdminRecovery />}
        {path === '/admin/support' && <AdminSupport />}
        {path === '/admin/features' && <AdminFeatures />}
        {path === '/admin/settings' && <AdminSettings />}
      </WorkspaceShell>
    );
  }

  // Customer Workspace Routes (Protected: 5-State Route Guard)
  if (
    path === '/dashboard' ||
    path === '/projects' ||
    path.startsWith('/projects/') ||
    path === '/actions' ||
    path === '/invoices' ||
    path === '/reports' ||
    path === '/billing' ||
    path.startsWith('/settings') ||
    path.startsWith('/support')
  ) {
    if (s.authStatus === 'loading') {
      return (
        <main className="marketing" style={{display:'grid',placeItems:'center',minHeight:'100vh',textAlign:'center'}}>
          <p style={{color:'#888'}}>Memuat workspace perusahaan…</p>
        </main>
      );
    }
    if (s.authStatus === 'unauthenticated' || !s.actor) {
      return <AccessRequired />;
    }

    // State: authenticated-no-tenant
    if (!s.actor.orgId) {
      if (s.actor.isPlatformAdmin) {
        return (
          <main className="marketing" style={{display:'grid',placeItems:'center',minHeight:'100vh',textAlign:'center',padding:24}}>
            <div style={{maxWidth:480}}>
              <h2 style={{fontSize:24,color:'#fff',marginBottom:12}}>Akun Platform Administrator</h2>
              <p style={{color:'#888',marginBottom:24}}>
                Identitas Anda adalah Platform Administrator tanpa keanggotaan tenant kontraktor.
              </p>
              <a className="btn btn-white" href="/admin">Buka Admin Console</a>
            </div>
          </main>
        );
      }
      return <OnboardingCompanyPage />;
    }

    // State: authenticated-tenant
    let content = <Dashboard />;

    if (path === '/dashboard') content = <Dashboard />;
    else if (path === '/projects') content = <ProjectList />;
    else if (path.startsWith('/projects/')) {
      const projectId = path.replace('/projects/', '').split('/')[0];
      content = <ProjectDetail id={projectId || 'p1'} />;
    }
    else if (path === '/actions') content = <ActionList />;
    else if (path === '/invoices') content = <InvoiceList />;
    else if (path === '/reports') content = <ReportsView />;
    else if (path === '/billing') content = <BillingView />;
    else if (path === '/settings') content = <CompanySettingsView />;
    else if (path === '/settings/team') content = <TeamSettingsView />;
    else if (path === '/settings/profile') content = <ProfileView />;
    else if (path.startsWith('/support')) content = <SupportView />;

    return <WorkspaceShell>{content}</WorkspaceShell>;
  }

  // Fallback 404
  return (
    <main className="marketing" style={{display:'grid',placeItems:'center',minHeight:'100vh',textAlign:'center',padding:24}}>
      <div style={{maxWidth:480}}>
        <h1 style={{fontSize:64,fontWeight:900,color:'#00a6ff'}}>404</h1>
        <h2 style={{fontSize:24,color:'#fff',marginTop:12}}>Halaman Tidak Ditemukan</h2>
        <p style={{color:'#888',marginTop:8,marginBottom:24}}>
          Rute yang Anda tuju (<code>{path}</code>) belum terdaftar atau telah dipindahkan.
        </p>
        <div className="button-row" style={{justifyContent:'center'}}>
          <a className="btn btn-white" href="/">Kembali ke Beranda</a>
          <a className="btn btn-outline" href="/dashboard">Buka Workspace</a>
        </div>
      </div>
    </main>
  );
}
