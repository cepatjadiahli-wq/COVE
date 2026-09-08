import {useState} from 'react';
import {
  ArrowUpRight,RotateCcw,Shield,CheckCircle2,SlidersHorizontal,Eye,
  Building2,CreditCard,Activity,ReceiptText,ListChecks,FileSpreadsheet
} from 'lucide-react';
import {Link,useRoute} from '@/lib/router';
import {useStore,type PreviewRole,type PreviewState} from '@/lib/store';
import {PageHeading,Panel,Btn,Choice,Badge,Notice} from '@/components/cove/ui';
import {PublicHeader,PublicFooter} from './public';

export function PreviewHub(){
  const s=useStore();
  const {go}=useRoute();

  const sections=[
    {
      title:'Situs Publik & Alur Pendaftaran',
      desc:'Pengalaman pengunjung sebelum masuk ke aplikasi aktif',
      links:[
        {name:'Beranda Marketing',path:'/',note:'Hero orbit, 3 masalah, preview 6 tahap, cara mulai'},
        {name:'Cara Kerja',path:'/cara-kerja',note:'Penjelasan proses, ledger komersial, 3 pilar operasional'},
        {name:'Harga & Paket',path:'/pricing',note:'Paid Pilot, Core, Scale, Enterprise & FAQ pembayaran'},
        {name:'Bantuan Publik',path:'/bantuan',note:'FAQ akses akun, pembayaran, dan kanal kontak resmi'},
        {name:'Masuk (Login)',path:'/login',note:'Form masuk dengan tombol pengisi cepat akun simulasi'},
        {name:'Daftar (Signup)',path:'/signup',note:'Form registrasi akun dengan pemilihan paket intent'},
        {name:'Konfirmasi Email',path:'/verify-email',note:'Status verifikasi email tersamar dengan cooldown kirim ulang'},
        {name:'Lupa Password',path:'/forgot-password',note:'Form pemulihan kata sandi'},
        {name:'Onboarding Perusahaan',path:'/onboarding',note:'Tahap 1: Identitas perusahaan sebelum checkout'},
        {name:'Tinjau Pesanan (Checkout)',path:'/checkout',note:'Halaman pesanan langganan COVE & simulasi Mayar'},
        {name:'Status Pembayaran',path:'/payment/status',note:'Hasil verifikasi pembayaran Mayar & opsi next step'},
        {name:'Setup Proyek Pertama',path:'/onboarding/project',note:'Tahap 2: Input kontrak proyek pertama sesudah bayar'}
      ]
    },
    {
      title:'Workspace Pelanggan (Ruang Kerja Kontraktor)',
      desc:'Aplikasi harian tim proyek dan keuangan kontraktor',
      links:[
        {name:'Ringkasan (Dashboard)',path:'/dashboard',note:'Metrik kebocoran nilai, tindakan prioritas, forecast kas'},
        {name:'Proyek (Portofolio)',path:'/projects',note:'Daftar seluruh proyek aktif dan filter pencarian'},
        {name:'Detail Proyek (Gedung Meridian)',path:'/projects/p1',note:'5 tab: Ringkasan, Progres & Klaim, Tagihan, Dokumen, Kontrak'},
        {name:'Tindakan',path:'/actions',note:'Antrean hambatan material, PIC, tenggat, dan catatan riwayat'},
        {name:'Tagihan Proyek (AR)',path:'/invoices',note:'Invoice proyek kontraktor, penuaan piutang, dan alokasi penerimaan kas'},
        {name:'Laporan Komersial',path:'/reports',note:'Portfolio summary, value gaps G1-G5, aging, forecast & ekspor CSV'},
        {name:'Langganan COVE (Billing SaaS)',path:'/billing',note:'Status paket SaaS COVE, kuota proyek 3/3, dan faktur bulanan'},
        {name:'Pengaturan Perusahaan',path:'/settings',note:'Identitas legal PT/CV, zona waktu, dan mata uang IDR'},
        {name:'Tim & Peran',path:'/settings/team',note:'Daftar staf internal (Owner, QS, Finance, PM) & undang anggota'},
        {name:'Profil & Preferensi',path:'/settings/profile',note:'Identitas profil, switch simulasi peran, dan consent privasi'},
        {name:'Bantuan & Feedback',path:'/support',note:'Tiket dukungan teknis dan formulir usulan fitur baru'}
      ]
    },
    {
      title:'Konsol Internal Admin COVE',
      desc:'Alat operasional internal untuk mengelola bisnis SaaS COVE',
      links:[
        {name:'Ringkasan SaaS',path:'/admin',note:'MRR, ARR, churn rate, kesehatan sistem, daftar tenant'},
        {name:'Langganan & Pembayaran',path:'/admin/billing',note:'Log webhook Mayar real-time, rekonsiliasi pembayaran'},
        {name:'Prospek & Recovery',path:'/admin/recovery',note:'Pemantauan checkout belum bayar dan recovery WhatsApp'},
        {name:'Dukungan Pelanggan',path:'/admin/support',note:'Inbox tiket bantuan masuk, balasan publik vs catatan internal'},
        {name:'Usulan Fitur',path:'/admin/features',note:'Canonical backlog permintaan fitur dari seluruh kontraktor'},
        {name:'Pengaturan Platform',path:'/admin/settings',note:'Status integrasi Mayar/Meta Pixel dan audit log admin'}
      ]
    }
  ];

  return (
    <main className="marketing">
      <PublicHeader/>
      <div style={{maxWidth:1280,margin:'40px auto',padding:'0 24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:20,marginBottom:32}}>
          <div>
            <p className="eyebrow"><span/> PUSAT NAVIGASI & VERIFIKASI</p>
            <h1 style={{fontSize:32,fontWeight:800,color:'#fff',marginTop:6}}>Pusat Navigasi & Verifikasi COVE</h1>
            <p style={{fontSize:15,color:'#a3a3a3',marginTop:4}}>
              Jelajahi seluruh 30+ rute antarmuka, verifikasi sinkronisasi backend multi-peran, dan uji tata kelola komersial.
            </p>
          </div>
          <div className="button-row">
            <Btn secondary onClick={()=>{s.reset(); s.setNotice('Seluruh data disinkronkan kembali.');}}>
              <RotateCcw size={16}/> Sinkronisasi Data Awal
            </Btn>
            <Link className="btn btn-white" href="/dashboard">
              Buka Dashboard <ArrowUpRight size={16}/>
            </Link>
          </div>
        </div>

        {/* Live Scenario Control Panel */}
        <div style={{background:'#141414',border:'1px solid #242424',borderRadius:14,padding:24,marginBottom:36}}>
          <h2 style={{fontSize:18,fontWeight:700,color:'#fff',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
            <SlidersHorizontal size={18} style={{color:'#00a6ff'}}/> Kontrol Sesi & Hak Akses Multi-Peran
          </h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:20}}>
            <div>
              <Choice
                label="Peran Aktif Pengguna (Simulasi Hak Akses)"
                value={s.role}
                onChange={v=>{s.setRole(v as PreviewRole); s.setNotice('Peran berganti menjadi '+v);}}
                options={[
                  {value:'OWNER',label:'OWNER — Direktur / Pengelola Perusahaan'},
                  {value:'QS',label:'QS — Commercial & Kontrak Lapangan'},
                  {value:'FINANCE_MANAGER',label:'FINANCE_MANAGER — Keuangan & AR'},
                  {value:'PROJECT_MANAGER',label:'PROJECT_MANAGER — Operasional Lapangan'},
                  {value:'AUDITOR',label:'AUDITOR — Pemeriksa Kepatuhan (Read-Only)'}
                ]}
              />
              <small style={{color:'#777',fontSize:11,display:'block',marginTop:4}}>
                *Mengubah wewenang tombol tindakan, pencatatan kas, dan izin kontrak.
              </small>
            </div>

            <div>
              <Choice
                label="Kondisi Tampilan Workspace"
                value={s.state}
                onChange={v=>{s.setState(v as PreviewState); s.setNotice('Kondisi tampilan: '+v);}}
                options={[
                  {value:'normal',label:'Data Tersedia (Normal)'},
                  {value:'empty',label:'Belum Ada Data (Empty State)'},
                  {value:'loading',label:'Sedang Memuat (Skeleton Loading)'},
                  {value:'error',label:'Gagal Memuat (Error State)'},
                  {value:'denied',label:'Tidak Punya Akses (Permission Denied)'},
                  {value:'restricted',label:'Hanya Baca (Restricted Read-Only)'},
                  {value:'stale',label:'Data Usang (Stale Warning)'},
                  {value:'conflict',label:'Konflik Data (Concurrent Update)'}
                ]}
              />
              <small style={{color:'#777',fontSize:11,display:'block',marginTop:4}}>
                *Menguji ketahanan StateBoundary pada seluruh komponen workspace.
              </small>
            </div>
          </div>
        </div>

        {/* Route Index Grids */}
        <div style={{display:'flex',flexDirection:'column',gap:32}}>
          {sections.map((sec,idx)=>(
            <div key={idx}>
              <div style={{marginBottom:14}}>
                <h3 style={{fontSize:20,fontWeight:700,color:'#fff'}}>{sec.title}</h3>
                <p style={{fontSize:13,color:'#888'}}>{sec.desc}</p>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',gap:14}}>
                {sec.links.map((link,i)=>(
                  <Link
                    key={i}
                    href={link.path}
                    style={{
                      background:'#111',
                      border:'1px solid #1f1f1f',
                      borderRadius:12,
                      padding:18,
                      display:'flex',
                      flexDirection:'column',
                      justifyContent:'space-between',
                      gap:10,
                      transition:'border-color .15s'
                    }}
                    className="preview-card"
                  >
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <strong style={{color:'#fafafa',fontSize:15}}>{link.name}</strong>
                      <ArrowUpRight size={16} style={{color:'#00a6ff',flexShrink:0}}/>
                    </div>
                    <code style={{fontSize:12,color:'#00a6ff',background:'#161616',padding:'2px 8px',borderRadius:4,alignSelf:'flex-start'}}>
                      {link.path}
                    </code>
                    <p style={{fontSize:12,color:'#737373',margin:0,lineHeight:1.5}}>
                      {link.note}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <PublicFooter/>
    </main>
  );
}
