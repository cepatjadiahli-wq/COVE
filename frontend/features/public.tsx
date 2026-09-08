import {useState, type ReactNode} from 'react';
import {ArrowRight, ArrowUpRight, Ruler, FileCheck2, FileText, Wallet, HardHat, ReceiptText, Menu, X, Check, ChevronDown} from 'lucide-react';
import {Link, useRoute} from '@/lib/router';
import {useStore} from '@/lib/store';
import {PLANS, afterAccess, type PlanId} from '@/lib/journey';
import {MARKETING_PATHS, NO_CONSENT} from '@/lib/privacy';
import {projectsSeed, STAGES, STAGE_COLORS, money, stageMetrics} from '@/lib/domain';
import {Btn, Check as CheckBox, Modal, Notice} from '@/components/cove/ui';

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const {path, go} = useRoute();
  const s = useStore();
  return <>{s.authStatus === 'authenticated' && !s.actor?.orgId && <div className="public-preview"><span>PENDAFTARAN PERUSAHAAN · Selesaikan onboarding perusahaan untuk memulai workspace</span><button onClick={()=>{s.logout();go('/');}}>Keluar <X size={14}/></button></div>}
    <a href="#main-content" className="skip-link">Lewati ke konten</a>
    <header className="public-header"><Link href="/" className="wordmark" aria-label="COVE — Beranda">COVE<span>●</span></Link>
      <nav aria-label="Navigasi publik" className={open?'public-nav is-open':'public-nav'}>
        {[['Cara Kerja','/cara-kerja'],['Harga','/pricing'],['Bantuan','/bantuan']].map(([label,url])=><Link key={url} href={url} aria-current={path===url?'page':undefined} onClick={()=>setOpen(false)}>{label}</Link>)}
        <Link href="/login" className="login-link" onClick={()=>setOpen(false)}>Masuk <ArrowUpRight size={16}/></Link>
      </nav>
      <button className="mobile-menu icon-button" aria-label={open?'Tutup menu':'Buka menu'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
    </header></>;
}
export function PublicFooter() {
  const s=useStore(); const {path}=useRoute();
  return <footer className="public-footer"><Link className="wordmark" href="/">COVE<span>●</span></Link><p>Construction Operations Value Engine<br/>Dari pekerjaan, menuju kas yang terlihat.</p><nav aria-label="Informasi COVE"><Link href="/bantuan">Bantuan</Link><Link href="/privasi">Privasi</Link><Link href="/ketentuan">Ketentuan</Link>{MARKETING_PATHS.includes(path)&&<button onClick={()=>s.setConsentOpen(true)}>Preferensi privasi</button>}</nav></footer>;
}
export function ConsentBanner() {
  const s=useStore(); const {path}=useRoute();
  const [analytics,setAnalytics]=useState(s.consents.analytics);
  const [ads,setAds]=useState(s.consents.ads);
  if(!MARKETING_PATHS.includes(path)) return null;
  const choose=(a:boolean,d:boolean)=>{s.setConsents({...NO_CONSENT,analytics:a,ads:d,answered:true});s.setConsentOpen(false);};
  return <>{!s.consents.answered&&!s.consentOpen&&<section className="consent-banner" aria-label="Pilihan privasi"><div><strong>Privasi, sesuai pilihan Anda.</strong><p>Penyimpanan esensial menjaga preferensi. Pengukuran opsional mati sampai Anda memilih; integrasi iklan belum diaktifkan.</p></div><div className="button-row"><Btn secondary onClick={()=>choose(false,false)}>Tolak opsional</Btn><Btn secondary onClick={()=>{setAnalytics(s.consents.analytics);setAds(s.consents.ads);s.setConsentOpen(true);}}>Atur preferensi</Btn></div></section>}
    <Modal open={s.consentOpen} onClose={()=>s.setConsentOpen(false)} title="Preferensi privasi" description="Pilihan ini tidak memengaruhi akses layanan. Dapat diubah kapan saja dari footer.">
      <p>Penyimpanan esensial selalu digunakan. Analitik dan pengukuran iklan opsional hanya untuk halaman publik yang diizinkan.</p>
      <CheckBox label="Izinkan analitik halaman publik" checked={analytics} onChange={setAnalytics}/>
      <CheckBox label="Izinkan pengukuran iklan di halaman publik" checked={ads} onChange={setAds}/>
      <Notice>Ini tidak memberikan persetujuan WhatsApp atau riset fitur. Tidak ada pelacak di workspace, halaman keuangan, dukungan, atau admin.</Notice>
      <div className="button-row"><Btn secondary onClick={()=>choose(false,false)}>Tolak opsional</Btn><Btn onClick={()=>choose(analytics,ads)}>Simpan pilihan</Btn></div>
    </Modal></>;
}
export function PublicFrame({children, narrow=false}: {children:ReactNode;narrow?:boolean}) {
  return <div className="marketing"><PublicHeader/><main id="main-content" tabIndex={-1} className={narrow?'access-container':'public-page'}>{children}</main><PublicFooter/></div>;
}
const stageIcons=[HardHat,Ruler,FileText,FileCheck2,ReceiptText,Wallet];
function Illustration({interactive=false}:{interactive?:boolean}) {
  const [selected,setSelected]=useState(0); const p=projectsSeed[0];const m=stageMetrics(p.values);
  const details=['Hasil kerja lapangan tercatat. Rp150 juta belum didukung pengukuran opname.','Opname tersedia. Rp150 juta belum dimasukkan ke klaim.','Klaim diajukan. Rp150 juta masih menunggu persetujuan.','BAP atau sertifikat disetujui. Rp150 juta belum menjadi invoice proyek.','Invoice terbit. Rp150 juta masih berupa piutang; Rp80 juta di antaranya lewat jatuh tempo.','Kas diterima dan dialokasikan ke invoice proyek. Pembayaran sebagian mengurangi piutang, bukan menciptakan invoice baru.'];
  return <div className="public-ledger">
    <header><div><p className="eyebrow">CONTOH PORTOFOLIO</p><h3>Gedung Meridian</h3><p>Kontrak Rp15 miliar · Posisi 8 September 2026</p></div><span className="specimen-badge">Spesimen Portofolio</span></header>
    <div className="illustration-stages">{STAGES.map((name,i)=><button disabled={!interactive} aria-pressed={interactive?selected===i:undefined} key={name} onClick={()=>setSelected(i)} className={interactive&&selected===i?'selected':''}><span><i style={{background:STAGE_COLORS[i]}}/>{name}</span><strong>{money(p.values[i],true)}</strong><span className="stage-track"><i style={{width:(p.values[i]/p.values[0]*100)+'%',background:STAGE_COLORS[i]}}/></span></button>)}</div>
    {interactive&&<div className="stage-explanation" role="status"><strong>{STAGES[selected]}</strong><p>{details[selected]}</p></div>}
    <div className="leakage-summary"><div><span>Nilai pekerjaan belum menjadi kas</span><strong>{money(m.total,true)}</strong></div><p><b>{money(m.unbilled,true)}</b> belum ditagihkan + <b>{money(m.receivable,true)}</b> piutang proyek. Lima selisih tahap masing-masing Rp150 juta.</p></div>
    <p className="footnote">Nilai kumulatif, tidak dijumlahkan antar-tahap. Leakage adalah nilai tertahan, bukan kerugian pasti. Retensi dan VO adalah rincian kontekstual, bukan tambahan G1–G5.</p>
  </div>;
}
export function HomePage() {
  return <div className="marketing"><PublicHeader/><main id="main-content" tabIndex={-1}>
    <section className="orbit-hero"><div className="orbits" aria-hidden="true"><i/><i/><i/>{stageIcons.map((Icon,i)=><span className={'orbit-icon orbit-icon-'+i} key={i}><Icon strokeWidth={1.6}/></span>)}</div>
      <div className="hero-copy"><p className="eyebrow"><span/> KONTROL KOMERSIAL UNTUK KONTRAKTOR</p><h1>Pekerjaan sudah berjalan.<br/><span>Tagihannya sampai mana?</span></h1><p className="hero-description">Lihat nilai pekerjaan yang belum menjadi invoice dan kas.<br className="desktop-break"/> COVE membantu tim Anda menemukan hambatan, menentukan PIC,<br className="desktop-break"/> dan menindaklanjuti yang paling berdampak.</p><Link className="btn btn-white hero-cta" href="/cara-kerja">Lihat Cara Kerja <ArrowUpRight/></Link><Link className="hero-secondary" href="/pricing">Lihat Paket <ArrowRight size={16}/></Link></div>
      <div className="hero-bottom"><span>PROGRESS → CASH</span><span>Enam tahap. Satu pandangan utuh.</span></div>
    </section>
    <section className="light-section"><div className="public-container"><p className="eyebrow">PERTANYAAN YANG SAMA, SETIAP MINGGU</p><div className="section-intro"><h2>Proyeknya bergerak.<br/>Nilainya juga?</h2><p>Pekerjaan di lapangan dan administrasi komersial tidak selalu bergerak bersama.</p></div><div className="problem-grid">{[
      ['01','Pekerjaan mana yang belum ditagihkan?','Satukan nilai dikerjakan, opname, klaim, dan persetujuan. Temukan selisih sebelum tertutup laporan yang terpisah.'],
      ['02','Uang tertahan di mana, dan berapa?','Bedakan nilai belum ditagihkan dari piutang yang sudah terbit. Jangan hitung keduanya dua kali.'],
      ['03','Siapa harus melakukan apa hari ini?','Ubah hambatan menjadi tindakan dengan penanggung jawab, tenggat, dan bukti penyelesaian.']
    ].map(([n,title,desc])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></div></section>
    <section className="marketing-section"><div className="public-container"><div className="section-intro dark-intro"><div><p className="eyebrow">DARI NILAI, MENJADI TINDAKAN</p><h2>Satu proyek.<br/>Rp750 juta perlu ditelusuri.</h2></div><p>Mulai dari selisih yang terlihat. Lalu cari dokumen, persetujuan, atau tindak lanjut yang belum selesai.</p></div><Illustration/></div></section>
    <section className="marketing-section section-rule"><div className="public-container"><p className="eyebrow">CARA KERJA COVE</p><div className="section-intro dark-intro"><h2>Rapikan datanya.<br/>Jelaskan langkah berikutnya.</h2><Link className="text-link" href="/cara-kerja">Jelajahi enam tahap <ArrowUpRight size={16}/></Link></div><div className="method-grid">{[['01','Hubungkan nilai & bukti','Catat kontrak, progres, opname, klaim, invoice, dan penerimaan. Impor spreadsheet melalui pemetaan dan pemeriksaan.'],['02','Temukan nilai tertahan','Lihat selisih G1–G5 tanpa menambah nilai yang sama berkali-kali. Turun ke proyek dan dokumen terkait.'],['03','Tindak lanjuti bersama','Tetapkan PIC dan tenggat. Simpan catatan, pantau persetujuan, dan perbarui alokasi kas.']].map(([n,title,desc])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></div></section>
    <section className="marketing-section section-rule"><div className="public-container"><p className="eyebrow">SATU KONTEKS, LINTAS PERAN</p><h2 className="section-title">Tim yang berbeda.<br/>Angka yang bisa dibicarakan bersama.</h2><div className="role-grid">{[['Direktur & pemilik','Lihat eksposur nilai lintas proyek dan prioritas komersial.'],['QS & commercial','Telusuri opname, klaim, sertifikat, dan perubahan kontrak.'],['Finance','Kelola invoice proyek, umur piutang, dan alokasi penerimaan.'],['Project manager','Lengkapi bukti progres dan tuntaskan hambatan lapangan.']].map(([name,desc])=><article key={name}><h3>{name}</h3><p>{desc}</p></article>)}</div></div></section>
    <section className="marketing-section proof-section"><div className="public-container"><p className="eyebrow">TRANSPARANSI SEJAK AWAL</p><h2 className="section-title">Bukan janji kas pasti cair.</h2><p>COVE membantu Anda melihat dan mengelola proses. Hasil bergantung pada kelengkapan data, tindak lanjut tim, dan pihak pembayar. Semua angka pada halaman ini adalah contoh pemodelan; data aktual dikelola secara aman dalam workspace perusahaan Anda.</p></div></section>
    <section className="marketing-section"><div className="public-container"><div className="section-intro dark-intro"><div><p className="eyebrow">MULAI SESUAI KEBUTUHAN</p><h2>Dari satu proyek,<br/>ke seluruh portofolio.</h2></div><Link className="btn btn-white" href="/pricing">Lihat Paket <ArrowUpRight/></Link></div><div className="plan-teaser"><span>Paid Pilot · 1 proyek</span><span>Core · hingga 3 proyek</span><span>Scale · hingga 10 proyek</span><span>Enterprise · kebutuhan khusus</span></div><FAQ short/></div></section>
    </main><PublicFooter/></div>;
}
export function HowItWorksPage() {
  return <PublicFrame><section className="public-page-heading"><p className="eyebrow">CARA KERJA</p><h1>Ikuti nilai pekerjaan.<br/>Sampai menjadi kas.</h1><p>Enam tahap Progress-to-Cash memperlihatkan apa yang sudah terjadi dan apa yang perlu ditindaklanjuti. Pilih tahap pada contoh untuk melihat konteksnya.</p></section><Illustration interactive/><section className="marketing-section compact-section"><div className="method-grid">{[['Opname → Klaim','Catat pengukuran yang didukung berita acara, lalu kaitkan klaim ke periode pekerjaan.'],['Sertifikat → Invoice','Persetujuan BAP atau sertifikat menjadi dasar penagihan. Invoice proyek berbeda dari tagihan layanan COVE.'],['Penerimaan → Tindak lanjut','Alokasikan kas ke invoice. Pantau sisa piutang dan janji bayar sebagai estimasi, bukan kas yang pasti diterima.']].map(([title,desc])=><article key={title}><h3>{title}</h3><p>{desc}</p></article>)}</div></section><Notice>COVE mengelola alur komersial dari pekerjaan fisik lapangan hingga kas diterima di rekening bank.</Notice><div className="public-closing"><h2>Sudah terlihat cara kerjanya?</h2><Link className="btn btn-white" href="/pricing">Lihat Paket <ArrowRight/></Link></div></PublicFrame>;
}
export function PricingPage() {
  const s=useStore();const {go}=useRoute();
  function select(plan:PlanId){s.setJourney(v=>({...v,intent:plan}));go(afterAccess(s.journey,plan));}
  return <PublicFrame><section className="public-page-heading centered"><p className="eyebrow">PAKET COVE</p><h1>Mulai dengan skala<br/>yang masuk akal.</h1><p>Pilih kebutuhan tim Anda. Identitas perusahaan dilengkapi sebelum review pembayaran; proyek pertama disiapkan setelah langganan terverifikasi aktif.</p></section>
    <Notice>Katalog harga resmi COVE (SaaS Subscription). Pemilihan di bawah mengarahkan Anda ke alur pendaftaran dan checkout terverifikasi.</Notice>
    <div className="pricing-grid">{Object.entries(PLANS).map(([id,plan])=><article className={'plan-card '+(id==='core'?'featured':'')} key={id}><p className="eyebrow">{plan.period}</p><h2>{plan.name}</h2><p>{plan.description}</p><div className="plan-price">{money(plan.price, false)}<small> / {plan.period}</small></div><ul>{[plan.projects?'Hingga '+plan.projects+' proyek aktif':'Kuota proyek kustom','Progress-to-Cash & tindakan komersial',id==='enterprise'?'Ruang lingkup implementasi kustom':'Invoice proyek (AR) & penerimaan kas',id==='pilot'?'Baseline & kriteria sukses pilot':'Laporan komersial & ekspor data'].map(text=><li key={text}><Check size={16}/>{text}</li>)}</ul><Btn secondary={id!=='core'} onClick={()=>select(id as PlanId)}>{s.journey.status==='active'?(s.journey.activePlan===id?'Buka langganan aktif':'Tinjau perubahan paket'):'Pilih '+plan.name}<ArrowUpRight size={16}/></Btn></article>)}</div>
    <p className="footnote">Harga belum termasuk PPN 11%. Tagihan langganan SaaS COVE terpisah sepenuhnya dari piutang dan invoice proyek kontraktor kepada pemberi kerja / owner.</p><FAQ/>
  </PublicFrame>;
}
function FAQ({short=false}:{short?:boolean}) {
  const entries=[['Apakah COVE menjamin pembayaran owner?','Tidak. COVE memberi visibilitas nilai dan membantu koordinasi tindak lanjut. Waktu pembayaran tetap bergantung pada kontrak dan pihak pembayar.'],['Kapan saya mulai mengisi proyek?','Setelah identitas perusahaan lengkap dan langganan dinyatakan aktif oleh server. Pemilihan paket atau redirect pembayaran tidak mengaktifkan akses.'],['Apakah invoice proyek termasuk tagihan COVE?','Tidak. Invoice proyek adalah tagihan kontraktor kepada owner proyek. Langganan COVE adalah tagihan perangkat lunak yang dikelola terpisah.'],['Bagaimana jika saya diundang sebagai staf?','Gunakan alur undangan organisasi. Staf undangan tidak perlu membeli paket pribadi.'],['Bisakah paket dibatalkan atau diubah?','Pengelola perusahaan meninjau perubahan melalui Langganan COVE. Dampak pada periode, biaya, dan kuota harus ditampilkan sebelum konfirmasi.']];
  return <section className="faq"><h2>Pertanyaan yang sering muncul</h2>{entries.slice(0,short?3:entries.length).map(([q,a])=><details key={q}><summary>{q}<ChevronDown size={18}/></summary><p>{a}</p></details>)}</section>;
}
export function HelpPage(){return <PublicFrame><section className="public-page-heading"><p className="eyebrow">BANTUAN COVE</p><h1>Ada yang menghambat?<br/>Mari perjelas.</h1><p>Akses bantuan tidak bergantung pada pembayaran. Kelola pertanyaan akun, komplain, atau usulan fitur dari area dukungan.</p></section><div className="method-grid">{[['Akses & undangan','Pastikan Anda menggunakan alamat email yang menerima undangan. Jangan membuat perusahaan baru jika Anda bergabung sebagai staf.','/invitation','Lihat undangan'],['Pembayaran layanan','Simpan referensi pesanan Anda. Jangan mengirim token, password, rekening, atau dokumen proyek ke kanal marketing.','/billing/status','Lihat status pembayaran'],['Masalah & ide produk','Buat tiket, ikuti percakapan, dan ceritakan fitur yang Anda butuhkan.','/support','Bantuan & Feedback']].map(([title,desc,url,cta])=><article key={title}><h2>{title}</h2><p>{desc}</p><Link href={url} className="text-link">{cta}<ArrowUpRight size={16}/></Link></article>)}</div><FAQ/></PublicFrame>;}
export function PrivacyPolicyPage(){return <PublicFrame narrow><p className="eyebrow">PRIVASI</p><h1>Data Anda, konteks Anda.</h1><Notice>COVE mengutamakan keamanan dan kepatuhan privasi data komersial perusahaan Anda.</Notice><p>COVE menjamin privasi dan integritas data komersial proyek kontraktor. Preferensi consent disimpan secara aman. Seluruh transmisi data operasional terisolasi per-tenant organisasi.</p><p>Tidak ada Meta SDK atau pengiriman WhatsApp yang diaktifkan secara implisit. Izin analitik, iklan, WhatsApp, dan riset fitur adalah pilihan eksplisit terpisah.</p><Link className="text-link" href="/">Kembali ke Beranda <ArrowRight size={16}/></Link></PublicFrame>;}
export function TermsOfServicePage(){return <PublicFrame narrow><p className="eyebrow">KETENTUAN</p><h1>Tinjau sebelum berlangganan.</h1><Notice>Ketentuan Layanan Standar COVE mengatur penggunaan perangkat lunak, lisensi multi-peran, dan pemrosesan komersial.</Notice><p>Paket dan hak akses final mengikuti kontrak serta katalog resmi. COVE menyediakan visibilitas dan tata kelola komersial Progress-to-Cash.</p><p>Perubahan paket memperlihatkan dampak biaya, periode, dan kuota. Pengarsipan proyek mempertahankan integritas data riwayat.</p><Link className="text-link" href="/pricing">Kembali ke paket <ArrowRight size={16}/></Link></PublicFrame>;}
