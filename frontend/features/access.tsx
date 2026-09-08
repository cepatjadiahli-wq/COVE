import {useState, useEffect, type FormEvent, type ReactNode} from 'react';
import {ArrowRight, ShieldCheck, Clock3, Building2, Check, AlertTriangle} from 'lucide-react';
import {Link, useRoute} from '@/lib/router';
import {useStore} from '@/lib/store';
import {api} from '@/lib/api';
import {supabase} from '@/lib/supabase';
import {PLANS, parsePlan, intentQuery, afterAccess, canReviewCheckout, canSetupProject, projectLimit, safePath, type Journey} from '@/lib/journey';
import {money} from '@/lib/domain';
import {PublicFrame} from './public';
import {Btn, Field, Check as CheckBox, Notice, Choice, Panel} from '@/components/cove/ui';

function AccessLayout({title,description,children}:{title:string;description:string;children:ReactNode}) { return <PublicFrame narrow><p className="eyebrow">COVE · AKUN PERUSAHAAN</p><h1>{title}</h1><p>{description}</p>{children}</PublicFrame>; }
function ProgressSteps({current}:{current:number}) { return <ol className="journey-steps" aria-label="Tahapan berlangganan">{['Akun','Perusahaan','Checkout','Status','Proyek'].map((x,i)=><li key={x} aria-current={i===current?'step':undefined} className={i<=current?'reached':''}><span>{i<current?<Check size={13}/>:i+1}</span>{x}</li>)}</ol>; }
function PreviewDisclosure(){return <Notice tone="info">Sesi akun terhubung langsung ke backend server COVE (IDR · Asia/Jakarta).</Notice>;}
export function AccessRequired({admin=false}:{admin?:boolean}) {
  const {path,query}=useRoute();const plan=parsePlan(query.get('plan'));const next=safePath(path);
  return <AccessLayout title={admin?'Area internal COVE':'Masuk untuk melanjutkan'} description={admin?'Akses produksi memerlukan identitas dan grant platform yang diverifikasi server.':'Halaman ini memerlukan akun dan izin yang sesuai. Silakan masuk untuk mengakses workspace.'}>
    <Notice>Sesi Anda memerlukan login aktif. Silakan masuk dengan akun perusahaan Anda.</Notice>
    <Link className="btn" href={'/login?returnTo='+encodeURIComponent(next)+(plan?'&plan='+plan:'')}>Masuk <ArrowRight size={16}/></Link><Link className="text-link" href="/bantuan">Bantuan akun</Link>
  </AccessLayout>;
}
export function LoginPage(){return <AuthForm/>;}
export function SignupPage(){return <AuthForm signup/>;}
function AuthForm({signup=false}:{signup?:boolean}) {
  const s=useStore(); const {query,go}=useRoute();const plan=parsePlan(query.get('plan'))??s.journey.intent;
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [agree,setAgree]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const returnTo=safePath(query.get('returnTo'));const suffix=intentQuery(plan)+(plan?'&':'?')+'returnTo='+encodeURIComponent(returnTo);
  async function submit(e:FormEvent){
    e.preventDefault();
    if(!email.trim()||password.length<8||(signup&&(!name.trim()||!agree))){
      setError('Lengkapi identitas dan persetujuan; password minimal 8 karakter.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (signup) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() }
          }
        });
        if (signUpError) throw signUpError;
        setPassword('');
        // If session is created directly (e.g. auto-confirm enabled), reload server data
        if (signUpData?.session) {
          await s.reloadData();
          go('/onboarding' + suffix);
        } else {
          // Email confirmation is required: user remains UNAUTHENTICATED.
          // Zero manual signedIn = true state!
          go('/verify-email' + suffix);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (signInError) throw signInError;
        await s.reloadData();
        setPassword('');
        go(afterAccess(s.journey, plan, returnTo));
      }
    } catch(err: any) {
      setError(err.message || 'Gagal masuk ke server.');
    } finally {
      setBusy(false);
    }
  }
  return <AccessLayout title={signup?'Mulai dengan akun Anda.':'Selamat datang kembali.'} description={plan?'Pilihan Anda: '+PLANS[plan].name+'. Identitas perusahaan dilengkapi sebelum checkout.':'Masuk ke perusahaan Anda, atau bergabung melalui undangan tim.'}><ProgressSteps current={0}/><PreviewDisclosure/>
    <form className="stack" onSubmit={submit}>{signup&&<Field label="Nama lengkap" autoComplete="name" required value={name} onChange={e=>setName(e.target.value)}/>}<Field label="Email kerja" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><Field label="Password" type="password" autoComplete={signup?'new-password':'current-password'} minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} hint="Minimal 8 karakter."/>
      {signup&&<><CheckBox checked={agree} onChange={setAgree} label="Saya menyetujui Ketentuan Layanan dan Kebijakan Privasi COVE."/><p className="footnote">Baca <Link href="/ketentuan" className="text-link">ketentuan</Link> dan <Link href="/privasi" className="text-link">privasi</Link>. Persetujuan marketing tidak wajib.</p></>}{error&&<Notice tone="danger">{error}</Notice>}<Btn type="submit" disabled={busy}>{busy?'Memproses…':(signup?'Daftar Akun Perusahaan':'Masuk ke COVE')} <ArrowRight size={16}/></Btn></form>
    <div className="access-links"><Link href={(signup?'/login':'/signup')+suffix}>{signup?'Sudah punya akun? Masuk':'Belum punya akun? Daftar'}</Link>{!signup&&<Link href={'/forgot-password'+intentQuery(plan)}>Lupa password?</Link>}<Link href="/invitation">Saya menerima undangan tim</Link></div>
  </AccessLayout>;
}
export function VerifyEmailPage(){
  const s = useStore();
  const {query} = useRoute();
  const plan = parsePlan(query.get('plan')) ?? s.journey.intent;
  const [notice, setNotice] = useState('');

  return (
    <AccessLayout title="Verifikasi alamat email" description="Tautan verifikasi aman telah dikirimkan ke email pendaftaran Anda.">
      <Notice tone="info">
        Silakan periksa kotak masuk atau spam email Anda dan klik tautan konfirmasi untuk mengaktifkan akun. Sesi akun akan terbentuk secara sah setelah email terverifikasi.
      </Notice>
      {notice && <Notice>{notice}</Notice>}
      <div className="button-row">
        <Btn secondary onClick={() => setNotice('Instruksi verifikasi ulang telah dikirimkan ke email Anda.')}>
          Kirim ulang tautan verifikasi
        </Btn>
        <Link className="btn" href={'/login' + intentQuery(plan)}>
          Masuk ke Akun Terverifikasi <ArrowRight size={16}/>
        </Link>
      </div>
      <Link className="text-link" href="/bantuan">Kendala saat verifikasi? Hubungi bantuan</Link>
    </AccessLayout>
  );
}

export function ForgotPasswordPage(){
  const [email,setEmail]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  async function submitForgot(e:FormEvent){
    e.preventDefault();
    if(!email.trim()) return;
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password'
      });
      setNotice('Jika akun terdaftar, tautan pemulihan telah dikirim ke email tersebut.');
    } catch(err: any) {
      setNotice(err.message || 'Permintaan pemulihan diproses.');
    } finally {
      setBusy(false);
    }
  }
  return <AccessLayout title="Pulihkan akses akun" description="Gunakan alamat email yang terhubung ke akun COVE.">
    <form className="stack" onSubmit={submitForgot}>
      <Field label="Email kerja" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/>
      {notice&&<Notice>{notice}</Notice>}
      <Btn type="submit" disabled={busy}>{busy?'Mengirim…':'Minta tautan pemulihan'}</Btn>
    </form>
    <Link className="text-link" href="/login">Kembali ke masuk</Link>
  </AccessLayout>;
}

export function ResetPasswordPage(){
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui kata sandi. Sesi pemulihan mungkin telah kedaluwarsa.');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <AccessLayout title="Kata sandi berhasil diperbarui" description="Kredensial akun Anda telah diperbarui secara aman.">
        <Notice tone="info">Kata sandi baru Anda telah aktif. Silakan masuk kembali dengan kredensial baru.</Notice>
        <Link className="btn" href="/login">Masuk ke COVE <ArrowRight size={16}/></Link>
      </AccessLayout>
    );
  }

  if (hasSession === false) {
    return (
      <AccessLayout title="Sesi pemulihan tidak valid" description="Tautan pemulihan kata sandi mungkin telah kedaluwarsa atau tidak valid.">
        <Notice tone="warning">Tidak ada sesi pemulihan aktif. Silakan minta tautan pemulihan kata sandi baru.</Notice>
        <Link className="btn" href="/forgot-password">Minta Tautan Pemulihan <ArrowRight size={16}/></Link>
      </AccessLayout>
    );
  }

  return (
    <AccessLayout title="Atur kata sandi baru" description="Masukkan kata sandi baru untuk mengamankan akun perusahaan Anda.">
      <form className="stack" onSubmit={submitReset}>
        <Field label="Kata sandi baru" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} hint="Minimal 8 karakter."/>
        <Field label="Ulangi kata sandi baru" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/>
        {error && <Notice tone="danger">{error}</Notice>}
        <Btn type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Perbarui Kata Sandi'} <ArrowRight size={16}/></Btn>
      </form>
      <Link className="text-link" href="/forgot-password">Minta tautan pemulihan baru</Link>
    </AccessLayout>
  );
}

export function InvitationPage(){
  return (
    <AccessLayout title="Bergabung dengan tim Anda" description="Staf undangan menggunakan keanggotaan organisasi yang diverifikasi oleh server.">
      <Notice tone="info">
        Penerimaan undangan organisasi diverifikasi langsung oleh backend COVE.
        Untuk mengaktifkan akses proyek tim, silakan masuk dengan alamat email yang diundang.
      </Notice>
      <div className="button-row">
        <Link className="btn" href="/login?returnTo=%2Fdashboard">Masuk dengan email undangan <ArrowRight size={16}/></Link>
      </div>
      <Link className="text-link" href="/bantuan">Undangan bermasalah? Minta bantuan</Link>
    </AccessLayout>
  );
}

export function OnboardingCompanyPage(){
  const s=useStore();const {query,go}=useRoute();const plan=parsePlan(query.get('plan'))??s.journey.intent;
  const [company,setCompany]=useState(s.onboarding.company);const [legal,setLegal]=useState('PT');const [address,setAddress]=useState('');const [tax,setTax]=useState('');const [wa,setWa]=useState(false);const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  if(!s.journey.enabled||s.authStatus !== 'authenticated')return <AccessRequired/>;
  if(s.journey.invited)return <InvitationPage/>;
  if(s.company)return <AccessLayout title="Perusahaan Anda sudah aktif" description="Kelola identitas dan langganan tanpa membuat checkout baru."><Link className="btn" href="/settings">Pengaturan Perusahaan</Link><Link className="text-link" href="/billing">Langganan COVE</Link></AccessLayout>;

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!company.trim()||!address.trim()){
      setError('Lengkapi nama dan alamat perusahaan.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Option A: Canonical server write to /api/organizations
      await api.createOrganization({
        legalName: company.trim(),
        displayName: company.trim()
      });
      // Synchronize canonical state from backend
      await s.reloadData();
      go('/checkout' + intentQuery(plan));
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan identitas perusahaan ke server.');
    } finally {
      setBusy(false);
    }
  }

  return <AccessLayout title="Kenali perusahaan Anda." description="Identitas ini digunakan untuk organisasi dan tagihan layanan COVE. Belum perlu mengisi data proyek."><ProgressSteps current={1}/><PreviewDisclosure/><form onSubmit={submit} className="stack"><Field label="Nama legal perusahaan" required value={company} onChange={e=>setCompany(e.target.value)} placeholder="Contoh: PT Konstruksi Nusantara"/><Choice label="Bentuk usaha" value={legal} onChange={setLegal} options={['PT','CV','Lainnya']}/><Field label="Alamat perusahaan" multiline required value={address} onChange={e=>setAddress(e.target.value)}/><Field label="NPWP (opsional)" value={tax} onChange={e=>setTax(e.target.value)} hint="NPWP 15 atau 16 digit perusahaan untuk penerbitan faktur."/><CheckBox label="Saya bersedia dihubungi lewat WhatsApp tentang informasi layanan COVE (opsional)." checked={wa} onChange={setWa}/><p className="footnote">Izin ini terpisah dari analitik platform. Dapat ditarik kembali sewaktu-waktu.</p>{error&&<Notice tone="danger">{error}</Notice>}<Btn type="submit" disabled={busy}>{busy ? 'Menyimpan ke server…' : 'Simpan Identitas Perusahaan'} <ArrowRight size={16}/></Btn></form></AccessLayout>;
}

export function CheckoutPage(){
  const s=useStore();const {query,go}=useRoute();const plan=parsePlan(query.get('plan'))??s.journey.intent;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if(!s.journey.enabled||s.authStatus !== 'authenticated')return <AccessRequired/>;
  if(!canReviewCheckout(s.journey))return <AccessLayout title="Lanjutkan proses yang sudah ada" description="Checkout baru tidak dibuat bila ada pembayaran menunggu, langganan aktif, atau langkah sebelumnya belum lengkap."><Link className="btn" href={afterAccess(s.journey,plan)}>Lanjutkan <ArrowRight size={16}/></Link></AccessLayout>;
  if(!plan)return <AccessLayout title="Pilih paket terlebih dahulu" description="Paket dari URL yang tidak dikenali tidak digunakan untuk membuat checkout."><Link className="btn" href="/pricing">Lihat Paket</Link></AccessLayout>;

  const p = PLANS[plan];
  const subtotal = p.price;
  const vat = Math.round(subtotal * 0.11);
  const total = subtotal + vat;

  async function proceedToCheckout() {
    setBusy(true);
    setError('');
    try {
      if (!plan) return;
      const checkoutRes = await api.createCheckout(plan);
      if (checkoutRes && checkoutRes.paymentUrl) {
        window.location.href = checkoutRes.paymentUrl;
      } else {
        throw new Error('Penyedia pembayaran tidak mengembalikan URL pembayaran yang sah.');
      }
    } catch (err: any) {
      const msg = err.error === 'PAYMENT_PROVIDER_NOT_CONFIGURED' || err.message?.includes('PAYMENT_PROVIDER_NOT_CONFIGURED')
        ? 'Pembayaran belum tersedia pada tahap ini (Penyedia pembayaran belum dikonfigurasi).'
        : (err.message || 'Gagal memulai checkout server.');
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessLayout title="Tinjau langganan COVE." description="Ini tagihan perangkat lunak COVE, bukan invoice proyek Anda kepada owner.">
      <ProgressSteps current={2}/>
      <div className="review-summary">
        <Building2 size={22}/>
        <div><strong>{s.company || 'Perusahaan Anda'}</strong><p>Identitas perusahaan terdaftar.</p></div>
        <Link className="text-link" href={'/onboarding'+intentQuery(plan)}>Ubah</Link>
      </div>
      <Panel title={'Paket '+p.name}>
        <div className="panel-padding stack">
          <dl className="key-values">
            <dt>Periode tagihan</dt><dd>{p.period}</dd>
            <dt>Kuota proyek aktif</dt><dd>{p.projects??'Sesuai kontrak'}</dd>
            <dt>Biaya layanan SaaS</dt><dd>{money(subtotal, false)}</dd>
            <dt>PPN 11%</dt><dd>{money(vat, false)}</dd>
            <dt>Total pembayaran</dt><dd><strong>{money(total, false)}</strong></dd>
          </dl>
        </div>
      </Panel>
      <Notice>Tagihan diproses resmi oleh server COVE (Mayar Gateway). Tidak ada debit otomatis tanpa otorisasi transaksi.</Notice>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="button-row">
        <Btn disabled={busy} onClick={proceedToCheckout}>
          {busy ? 'Menghubungi server Mayar…' : 'Lanjutkan ke Pembayaran Mayar'} <ArrowRight size={16}/></Btn>
      </div>
      <Link className="text-link" href="/pricing">Kembali ke paket</Link>
    </AccessLayout>
  );
}

const statusCopy = {
  none: ['Status belum tersedia','Belum ada status pembayaran terverifikasi. Parameter redirect tidak membuktikan pembayaran.'],
  pending: ['Menunggu pembayaran','Pesanan menunggu settlement gateway Mayar. Selesaikan pembayaran melalui instruksi dari Mayar.'],
  verifying: ['Pembayaran sedang diverifikasi','Bukti settlement sedang diperiksa server. Jangan membayar ulang sebelum status transaksi selesai diverifikasi.'],
  active: ['Aktif — Entitlement Terverifikasi','Langganan Anda telah aktif melalui verifikasi server. Anda sekarang dapat menyiapkan proyek pertama.'],
  failed: ['Pembayaran gagal','Tidak ada akses baru yang diaktifkan. Silakan periksa status kartu/transfer atau coba kembali.'],
  expired: ['Pembayaran kedaluwarsa','Pesanan ini telah kedaluwarsa. Server akan menerbitkan sesi checkout baru jika Anda ingin mencoba lagi.'],
} as const;

export function PaymentStatusPage(){
  const s=useStore();const {go}=useRoute();const [checked,setChecked]=useState(false);const [busy,setBusy]=useState(false);
  const [serverBilling, setServerBilling] = useState<any>(null);

  useEffect(() => {
    api.getBilling()
      .then(b => setServerBilling(b))
      .catch(() => {});
  }, []);

  // 100% server-derived status (no journey.status or local fallbacks)
  const rawStatus = (serverBilling?.status || serverBilling?.subscription?.status || '').toUpperCase();
  const status: 'active' | 'pending' | 'failed' | 'expired' | 'none' =
    rawStatus === 'ACTIVE' ? 'active' :
    rawStatus === 'PENDING' ? 'pending' :
    rawStatus === 'FAILED' ? 'failed' :
    rawStatus === 'EXPIRED' ? 'expired' :
    'none';

  const [title,desc] = statusCopy[status] || statusCopy.none;

  return (
    <AccessLayout title={title} description={desc}>
      <ProgressSteps current={3}/>
      <div className={'payment-symbol '+status}>
        {status==='active'?<ShieldCheck size={36}/>:['failed','expired'].includes(status)?<AlertTriangle size={36}/>:<Clock3 size={36}/>}
      </div>
      {status==='pending'&& (
        <Panel title="Menunggu Konfirmasi Pembayaran">
          <div className="panel-padding stack">
            <p>Transaksi Anda sedang menunggu verifikasi settlement dari gateway Mayar.</p>
            <p className="footnote">Setelah transfer berhasil diselesaikan, server Mayar akan mengirimkan callback settlement resmi ke COVE untuk mengaktifkan kuota proyek secara instan.</p>
          </div>
        </Panel>
      )}
      <Notice>{s.journey.enabled?'Status diverifikasi oleh sistem entitlement server COVE.':'Tidak ada koneksi ke layanan verifikasi pembayaran.'}</Notice>
      {checked&&<Notice tone="info">Pemeriksaan status selesai: data telah disinkronkan dengan server backend.</Notice>}
      <div className="button-row">
        <Btn secondary disabled={busy} onClick={async ()=>{
          setBusy(true);
          try {
            const b = await api.getBilling();
            setServerBilling(b);
            await s.reloadData();
            setChecked(true);
          } finally {
            setBusy(false);
          }
        }}>{busy ? 'Memeriksa…' : 'Periksa status lagi'}</Btn>
        {status==='active'&&canSetupProject(s.journey)&&<Link className="btn" href={s.journey.firstProject?'/dashboard':'/onboarding/project'}>{s.journey.firstProject?'Buka Ringkasan':'Siapkan proyek pertama'} <ArrowRight size={16}/></Link>}
        {['failed','expired'].includes(status)&&<Btn onClick={()=>go('/checkout'+intentQuery(s.journey.intent))}>Tinjau ulang checkout</Btn>}
      </div>
      <Link className="text-link" href="/bantuan">Hubungi bantuan jika ada kendala</Link>
    </AccessLayout>
  );
}
export function OnboardingProjectPage(){
  const s=useStore();const {go}=useRoute();const [name,setName]=useState('');const [customer,setCustomer]=useState('');const [contract,setContract]=useState('');const [code,setCode]=useState('');const [location,setLocation]=useState('');const [step,setStep]=useState(0);const [error,setError]=useState('');
  if(s.authStatus !== 'authenticated' || !s.actor)return <AccessRequired/>;
  if(!canSetupProject(s.journey))return <AccessLayout title="Langganan aktif diperlukan" description="Setup proyek tersedia setelah identitas perusahaan dan entitlement aktif diverifikasi. Redirect atau checkout tidak cukup."><Link className="btn" href={afterAccess(s.journey,s.journey.intent)}>Lanjutkan proses langganan</Link></AccessLayout>;
  const limit=projectLimit(s.journey.activePlan);const active=s.projects.filter(p=>p.status==='Aktif').length;
  if(!s.writeable||s.role!=='OWNER')return <AccessLayout title="Minta pengelola menyiapkan proyek" description="Anda dapat bergabung pada proyek sesuai peran dan penugasan tanpa membeli paket pribadi."><Link className="btn" href="/support">Minta bantuan</Link></AccessLayout>;
  if(s.journey.firstProject&&limit!==null&&active>=limit)return <AccessLayout title="Kuota proyek aktif terpakai" description={'Perusahaan Anda telah menggunakan '+active+' dari '+limit+' kuota proyek aktif. Arsipkan proyek lama atau upgrade paket.'}><Link className="btn" href="/projects">Kelola proyek</Link><Link className="text-link" href="/billing">Langganan COVE</Link></AccessLayout>;
  async function submit(e:FormEvent){
    e.preventDefault();const amount=Number(contract);
    if(!name.trim()||!code.trim()||!customer.trim()||!Number.isSafeInteger(amount)||amount<=0){setError('Lengkapi nama, kode unik, owner proyek, dan nilai kontrak rupiah bulat lebih dari nol.');return;}
    if(s.projects.some(p=>p.code.toLowerCase()===code.trim().toLowerCase())){setError('Kode proyek sudah digunakan.');return;}
    if(step===0){setError('');setStep(1);return;}
    if(!canSetupProject(s.journey)||!s.writeable)return;
    try {
      await s.createProject({
        code: code.trim(),
        name: name.trim(),
        customer: customer.trim(),
        location: location.trim(),
        contract: amount,
        values: [0, 0, 0, 0, 0, 0]
      });
      s.setJourney(v=>({...v,firstProject:true}));
      s.setNotice('Proyek pertama berhasil dibuat! Kontrak adalah baseline awal; S1–S6 dimulai dari Rp 0.');
      go('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan proyek ke server');
    }
  }
  return <AccessLayout title={step?'Tinjau proyek pertama.':'Mulai dari satu proyek.'} description="Kontrak adalah baseline. Progres, klaim, invoice, dan kas hanya bertambah saat catatan masing-masing dimasukkan."><ProgressSteps current={4}/><form className="stack" onSubmit={submit}>{step===0?<><Field label="Nama proyek" required value={name} onChange={e=>setName(e.target.value)} placeholder="Contoh: Pembangunan Rukan Boulevard"/><Field label="Kode proyek" required value={code} onChange={e=>setCode(e.target.value)} placeholder="Contoh: PRJ-001"/><Field label="Owner proyek / pemberi kerja" required value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Contoh: PT Bangun Megah"/><Field label="Nilai kontrak (IDR)" type="number" min="1" step="1" required value={contract} onChange={e=>setContract(e.target.value)} placeholder="Contoh: 5000000000"/><Field label="Lokasi proyek" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Contoh: Surabaya, Jawa Timur"/></>:<><Panel title={name}><div className="panel-padding"><p><strong>{code}</strong> · {customer}</p><p>Nilai kontrak: {money(Number(contract), false)}</p><p>Semua tahap Progress-to-Cash (S1–S6): Rp 0</p></div></Panel><Btn secondary onClick={()=>setStep(0)}>Ubah identitas proyek</Btn></>}{error&&<Notice tone="danger">{error}</Notice>}<Btn type="submit">{step?'Buat proyek & buka Dashboard':'Tinjau proyek'} <ArrowRight size={16}/></Btn></form></AccessLayout>;
}
