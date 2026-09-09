import {useState,type FormEvent,useEffect} from 'react';
import {
  CreditCard,Building2,Users,User,LifeBuoy,Plus,Download,ArrowUpRight,
  Check,ShieldCheck,CheckCircle2,Clock3,Send,Lightbulb,MessageSquare,FileText
} from 'lucide-react';
import {useRoute,Link} from '@/lib/router';
import {useStore,type PreviewRole} from '@/lib/store';
import {money,dateLabel,type Ticket} from '@/lib/domain';
import {PageHeading,Panel,Btn,Field,Choice,Check as CheckBox,Notice,Modal,DataTable,Badge,StateBoundary} from '@/components/cove/ui';
import {api} from '@/lib/api';

export function BillingView(){
  const s=useStore();
  const {go}=useRoute();
  const [changePlan,setChangePlan]=useState(false);
  const [selectedPlan,setSelectedPlan]=useState('scale');
  const [billing,setBilling]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [checkoutLoading,setCheckoutLoading]=useState(false);

  useEffect(()=>{
    api.getBilling()
      .then(res => {
        setBilling(res);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Billing fetch error:', err);
        setLoading(false);
      });
  }, []);

  const handleUpgrade=async ()=>{
    try {
      setCheckoutLoading(true);
      const res = await api.createCheckout(selectedPlan);
      if (res?.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        s.setNotice('Sesi checkout berhasil dibuat. Silakan selesaikan pembayaran.');
        setChangePlan(false);
      }
    } catch (err: any) {
      s.setNotice(err.message || 'Layanan pembayaran SaaS Mayar belum dikonfigurasi di server.');
      setChangePlan(false);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const planName = billing?.subscription?.planName || (s.subscription === 'Aktif' ? 'Core' : 'Non-Aktif');
  const isSubActive = billing?.status === 'ACTIVE' || billing?.subscription?.status === 'ACTIVE';
  const planAmount = isSubActive && billing?.subscription?.amount ? money(billing.subscription.amount) + ' / bulan' : 'Rp0 / bulan';
  const quotaUsed = billing?.quota?.used ?? s.projects.filter(p=>p.status==='Aktif').length;
  const quotaTotal = billing?.quota?.total ?? (isSubActive ? 3 : 0);
  const quotaPercent = quotaTotal > 0 ? Math.min(100, Math.round((quotaUsed / quotaTotal) * 100)) : 0;
  const saasInvoices: any[] = billing?.history || [];

  return (
    <>
      <PageHeading
        eyebrow="LANGGANAN SAAS COVE"
        title="Langganan COVE"
        description="Kelola paket langganan perangkat lunak, kuota proyek aktif, dan tagihan akun perusahaan."
        action={
          s.role==='OWNER' && (
            <Btn onClick={()=>setChangePlan(true)}>
              <CreditCard size={16}/> Ubah Paket Langganan
            </Btn>
          )
        }
      />

      <StateBoundary>
        <div className="two-col">
          <Panel title="Paket Aktif Saat Ini" subtitle="Penagihan melalui Mayar">
            <div className="panel-padding stack" style={{gap:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <h3 style={{fontSize:22,fontWeight:800,color:'#fff'}}>Paket {planName}</h3>
                  <span style={{fontSize:13,color:'#a3a3a3'}}>{planAmount}</span>
                </div>
                {isSubActive ? (
                  <Badge tone="success">Aktif · Berlangganan</Badge>
                ) : (
                  <Badge tone="neutral">Non-Aktif</Badge>
                )}
              </div>

              <div style={{background:'#161616',padding:16,borderRadius:10,border:'1px solid #242424'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:8}}>
                  <span>Penggunaan Kuota Proyek Aktif:</span>
                  <strong>{quotaUsed} dari {quotaTotal} proyek terpakai ({quotaPercent}%)</strong>
                </div>
                <div className="mini-track">
                  <i style={{width:`${quotaPercent}%`,background: quotaPercent >= 100 ? '#ef4444' : '#fbbf24'}}/>
                </div>
                <small style={{color:'#888',fontSize:11,display:'block',marginTop:6}}>
                  {quotaTotal > 0 ? 'Untuk menambah kapasitas proyek baru, lakukan upgrade paket atau arsipkan proyek selesai.' : 'Aktifkan langganan untuk menambah kuota proyek.'}
                </small>
              </div>

              <dl className="key-values">
                <dt>Periode Aktif</dt>
                <dd>{billing?.subscription?.periodStart ? `${billing.subscription.periodStart} s.d. ${billing.subscription.periodEnd}` : 'Belum aktif'}</dd>
                <dt>Metode Bayar</dt>
                <dd>Mayar Payment Gateway</dd>
                <dt>Status Penagihan</dt>
                <dd>{billing?.status || 'NONE'}</dd>
              </dl>
            </div>
          </Panel>

          <Panel title="Informasi Penagihan & Faktur" subtitle="Data entitas perusahaan">
            <div className="panel-padding stack" style={{gap:14}}>
              <dl className="key-values">
                <dt>Nama Entitas</dt>
                <dd>{s.company || '-'}</dd>
                <dt>Email Penagihan</dt>
                <dd>{s.userEmail || '-'}</dd>
                <dt>ID Organisasi</dt>
                <dd>{s.actor?.orgId || '-'}</dd>
              </dl>
              <Notice tone="info">
                Tagihan SaaS ini terpisah dari tagihan operasional proyek konstruksi.
              </Notice>
            </div>
          </Panel>
        </div>

        <Panel title="Riwayat Pembayaran Langganan COVE" subtitle="Invoice resmi langganan SaaS">
          {saasInvoices.length > 0 ? (
            <DataTable
              caption="Riwayat Faktur SaaS COVE"
              headers={['Nomor Invoice SaaS','Tanggal','Periode Layanan','Nominal','Status','Tindakan']}
              rows={saasInvoices.map(inv=>[
                <strong>{inv.id}</strong>,
                inv.date,
                inv.period || '-',
                money(inv.amount),
                <Badge tone="success">{inv.status}</Badge>,
                <button className="btn btn-outline" style={{minHeight:28,padding:'2px 8px',fontSize:11}} onClick={()=>s.setNotice('Mengunduh receipt '+inv.id)}>
                  <Download size={12}/> Unduh Receipt
                </button>
              ])}
            />
          ) : (
            <div className="panel-padding" style={{textAlign:'center',color:'#888',padding:'32px 16px'}}>
              Belum ada riwayat pembayaran langganan SaaS pada organisasi ini.
            </div>
          )}
        </Panel>
      </StateBoundary>

      <Modal open={changePlan} onClose={()=>setChangePlan(false)} title="Ubah Paket Langganan COVE">
        <div className="stack" style={{gap:16}}>
          <p style={{fontSize:14,color:'#a3a3a3'}}>Pilih paket yang sesuai dengan kapasitas proyek aktif perusahaan Anda:</p>
          <Choice
            label="Pilihan Paket Baru"
            value={selectedPlan}
            onChange={setSelectedPlan}
            options={[
              {value:'core',label:'Core (s.d. 5 Proyek Aktif) — Rp4.900.000 / bln'},
              {value:'pilot',label:'Paid Pilot (s.d. 10 Proyek Aktif) — Rp7.500.000 / bln'},
              {value:'scale',label:'Scale (s.d. 25 Proyek Aktif) — Rp9.900.000 / bln'}
            ]}
          />
          <Notice tone="info">
            Pembayaran akan diproses secara aman melalui gateway Mayar.
          </Notice>
          <div className="button-row">
            <Btn secondary onClick={()=>setChangePlan(false)}>Batal</Btn>
            <Btn onClick={handleUpgrade} disabled={checkoutLoading}>
              {checkoutLoading ? 'Memproses...' : 'Lanjutkan ke Pembayaran'}
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function CompanySettingsView(){
  const s=useStore();
  const [name,setName]=useState(s.company);
  const [phone,setPhone]=useState('+62 21 555-0199');
  const [address,setAddress]=useState('');
  const [currency,setCurrency]=useState('IDR (Rupiah Indonesia)');
  const [timezone,setTimezone]=useState('WIB (Asia/Jakarta)');
  const [saving,setSaving]=useState(false);

  const save=async (e:FormEvent)=>{
    e.preventDefault();
    if (!s.actor?.orgId) {
      s.setNotice('Organisasi aktif belum dipilih.');
      return;
    }
    try {
      setSaving(true);
      await api.updateOrganization(s.actor.orgId, { legalName: name, displayName: name });
      s.setCompany(name);
      s.setNotice('Pengaturan perusahaan berhasil disimpan ke server.');
      await s.reloadData();
    } catch (err: any) {
      s.setNotice(err.message || 'Gagal menyimpan perubahan ke server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="KONFIGURASI PERUSAHAAN"
        title="Pengaturan Perusahaan"
        description="Identitas organisasi, preferensi mata uang, dan zona waktu operasional proyek."
      />

      <StateBoundary>
        <div className="two-col">
          <Panel title="Identitas Perusahaan" subtitle="Nama entitas yang tampil pada laporan dan dokumen">
            <form onSubmit={save} className="panel-padding stack" style={{gap:16}}>
              <Field label="Nama Perusahaan (PT/CV)" required value={name} onChange={e=>setName(e.target.value)}/>
              <Field label="Nomor Telepon Kantor" required value={phone} onChange={e=>setPhone(e.target.value)}/>
              <Field label="Alamat Kantor Pusat" multiline value={address} onChange={e=>setAddress(e.target.value)}/>
              {s.writeable ? (
                <Btn type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</Btn>
              ) : (
                <Notice tone="warning">Hanya Pengelola Perusahaan yang dapat mengubah pengaturan ini.</Notice>
              )}
            </form>
          </Panel>

          <Panel title="Preferensi Regional & Finansial" subtitle="Format angka dan zona waktu default">
            <div className="panel-padding stack" style={{gap:16}}>
              <Choice label="Mata Uang Pembukuan" value={currency} onChange={setCurrency} options={['IDR (Rupiah Indonesia)']}/>
              <Choice label="Zona Waktu Operasional" value={timezone} onChange={setTimezone} options={['WIB (Asia/Jakarta)','WITA (Asia/Makassar)','WIT (Asia/Jayapura)']}/>
              <dl className="key-values">
                <dt>Pemisah Ribuan</dt>
                <dd>Titik (contoh: Rp15.000.000)</dd>
                <dt>Format Tanggal</dt>
                <dd>8 Sep 2026 (DD MMM YYYY)</dd>
              </dl>
            </div>
          </Panel>
        </div>
      </StateBoundary>
    </>
  );
}

export function TeamSettingsView(){
  const s=useStore();

  // Production team members strictly derived from authenticated session actor
  const members = s.actor ? [
    {
      name: s.actor.fullName || s.userName || 'Pengguna',
      email: s.actor.email || s.userEmail || '',
      role: s.role || 'MEMBER',
      roleLabel: s.role === 'OWNER' ? 'Pengelola Perusahaan' : s.role || 'Anggota',
      status: 'Aktif'
    }
  ] : [];

  return (
    <>
      <PageHeading
        eyebrow="HAK AKSES & PENGGUNA"
        title="Tim & Peran"
        description="Kelola anggota tim internal perusahaan dan batas wewenang kerja komersial."
        action={
          <Btn disabled title="Undangan tim belum tersedia pada tahap ini.">
            <Plus size={16}/> Undangan tim belum tersedia pada tahap ini
          </Btn>
        }
      />

      <StateBoundary>
        <div className="overview-inline">
          <span>Pengguna aktif: <strong>{members.length} staf terdaftar</strong></span>
          <span>Peran aktif saat ini: <strong>{s.role || 'Belum memiliki peran'}</strong></span>
        </div>

        <Panel title="Daftar Staf & Hak Akses">
          <DataTable
            caption="Daftar Anggota Tim Perusahaan"
            headers={['Nama & Email','Peran Sistem','Wewenang','Status']}
            rows={members.map(m=>[
              <div style={{display:'flex',alignItems:'center',gap:10}} key={m.email}>
                <span className="avatar small">{m.name.split(' ').map((n: string)=>n[0]).join('')}</span>
                <div>
                  <strong style={{color:'#fff',fontSize:14,display:'block'}}>{m.name}</strong>
                  <small style={{color:'#888',fontSize:12}}>{m.email}</small>
                </div>
              </div>,
              <Badge tone={m.role==='OWNER'?'info':'neutral'}>{m.roleLabel}</Badge>,
              <span style={{fontSize:13,color:'#a3a3a3'}}>
                {m.role==='OWNER'?'Akses penuh, Billing & Kontrak':m.role==='FINANCE_MANAGER'?'Invoice, AR & Pencatatan Kas':m.role==='QS'?'Opname, Klaim & Checklist':'Hambatan & Dokumen'}
              </span>,
              <Badge tone="success">{m.status}</Badge>
            ])}
          />
        </Panel>
      </StateBoundary>
    </>
  );
}

export function ProfileView(){
  const s=useStore();
  return (
    <>
      <PageHeading
        eyebrow="PENGATURAN PENGGUNA"
        title="Profil & Preferensi"
        description="Identitas akun Anda, simulasi peran aktif, dan preferensi privasi."
      />

      <StateBoundary>
        <div className="two-col">
          <Panel title="Identitas Akun" subtitle={`Masuk sebagai ${s.userName || 'Pengguna'}`}>
            <div className="panel-padding stack" style={{gap:14}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <span className="avatar" style={{width:54,height:54,fontSize:18}}>
                  {s.userName ? s.userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : 'CO'}
                </span>
                <div>
                  <h3 style={{fontSize:18,fontWeight:700,color:'#fff'}}>{s.userName || 'Pengguna COVE'}</h3>
                  <p style={{fontSize:13,color:'#888'}}>{s.userEmail || '-'}</p>
                </div>
              </div>

              <div style={{padding:16,background:'#181818',borderRadius:10,marginTop:8}}>
                <span style={{fontSize:12,fontWeight:700,color:'#00a6ff',display:'block',marginBottom:4}}>
                  PERAN RESMI PADA ORGANISASI:
                </span>
                <p style={{fontSize:14,color:'#fff',fontWeight:600}}>{s.role ? s.role.replaceAll('_', ' ') : 'Belum ditetapkan'}</p>
                <small style={{color:'#888',fontSize:12}}>Peran ditetapkan oleh Administrator Organisasi sesuai kebijakan kontrol akses sistem (RBAC).</small>
              </div>
            </div>
          </Panel>

          <Panel title="Preferensi Notifikasi & Privasi">
            <div className="panel-padding stack" style={{gap:14}}>
              <CheckBox
                label="Email notifikasi invoice proyek lewat jatuh tempo"
                checked={true}
                onChange={()=>{}}
              />
              <CheckBox
                label="Ringkasan mingguan gap nilai dan tindakan terbuka"
                checked={true}
                onChange={()=>{}}
              />
              <CheckBox
                label="Pemberitahuan pembaruan sistem dan rilis fitur"
                checked={s.consents.analytics}
                onChange={v=>s.setConsents(c=>({...c,analytics:v}))}
              />
              <CheckBox
                label="Komunikasi konsultasi operasional melalui WhatsApp resmi"
                checked={s.consents.whatsapp}
                onChange={v=>s.setConsents(c=>({...c,whatsapp:v}))}
              />
            </div>
          </Panel>
        </div>
      </StateBoundary>
    </>
  );
}

export function SupportView(){
  const s=useStore();
  const {query,go}=useRoute();
  const tab=query.get('tab')||'tickets';
  const [createTicket,setCreateTicket]=useState(false);
  const [createFeature,setCreateFeature]=useState(false);
  const [viewTicket,setViewTicket]=useState<Ticket|null>(null);
  const [ticketReply,setTicketReply]=useState('');

  const [tTitle,setTTitle]=useState('');
  const [tCat,setTCat]=useState('Data proyek');
  const [tDesc,setTDesc]=useState('');

  const [fTitle,setFTitle]=useState('');
  const [fProb,setFProb]=useState('');
  const [fImpact,setFImpact]=useState('');
  const [fMod,setFMod]=useState('Laporan');

  const submitTicket=async(e:FormEvent)=>{
    e.preventDefault();
    try {
      const newTicket=await s.createTicket({
        title:tTitle,
        category:tCat,
        body:tDesc,
        priority:'P3'
      });
      s.setNotice('Tiket bantuan '+newTicket.id+' berhasil dibuat.');
      setCreateTicket(false);
      setTTitle('');
      setTDesc('');
    } catch (err: any) {
      s.setNotice(err.message || 'Gagal membuat tiket bantuan');
    }
  };

  const submitFeature=async(e:FormEvent)=>{
    e.preventDefault();
    try {
      const newFeature=await s.createFeature({
        title:fTitle,
        problem:fProb,
        module:fMod,
        commercialImpact:fImpact
      });
      s.setNotice('Usulan fitur '+newFeature.id+' berhasil dikirim ke tim produk.');
      setCreateFeature(false);
      setFTitle('');
      setFProb('');
      setFImpact('');
    } catch (err: any) {
      s.setNotice(err.message || 'Gagal mengirim usulan fitur');
    }
  };

  const handleReplyTicket=async(ticketId:string)=>{
    if(!ticketReply.trim()) return;
    try {
      await s.addTicketMessage(ticketId, ticketReply.trim());
      s.setNotice('Pesan berhasil ditambahkan ke tiket '+ticketId+'.');
      setTicketReply('');
      setViewTicket(null);
    } catch (err: any) {
      s.setNotice(err.message || 'Gagal mengirim balasan tiket');
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="DUKUNGAN & USULAN"
        title="Bantuan & Feedback"
        description="Buka tiket bantuan teknis privat, keluhan data, atau sampaikan usulan fitur untuk platform COVE."
        action={
          <div className="button-row">
            {tab==='tickets' ? (
              <Btn onClick={()=>setCreateTicket(true)}>
                <Plus size={16}/> Buat Tiket Bantuan
              </Btn>
            ) : (
              <Btn onClick={()=>setCreateFeature(true)}>
                <Lightbulb size={16}/> Usulkan Fitur Baru
              </Btn>
            )}
          </div>
        }
      />

      <StateBoundary>
        <div className="button-row" style={{marginBottom:16}}>
          <button className={`btn ${tab==='tickets'?'btn-white':'btn-outline'}`} onClick={()=>go('/support?tab=tickets')}>
            Tiket Bantuan Saya ({s.tickets.length})
          </button>
          <button className={`btn ${tab==='features'?'btn-white':'btn-outline'}`} onClick={()=>go('/support?tab=features')}>
            Usulan Fitur Saya ({s.features.length})
          </button>
        </div>

        {tab==='tickets' ? (
          <Panel title="Daftar Tiket Bantuan Saya" subtitle="Percakapan dukungan privat antara perusahaan Anda dan tim teknis COVE">
            <DataTable
              caption="Tiket Bantuan Pelanggan"
              headers={['ID Tiket','Judul Masalah','Kategori','Prioritas','Status','Pembaruan Terakhir','Aksi']}
              rows={s.tickets.map(t=>[
                <strong>{t.id}</strong>,
                <span style={{color:'#fff',fontWeight:600}}>{t.title}</span>,
                t.category,
                <Badge tone={t.priority==='P1'?'danger':'warning'}>{t.priority}</Badge>,
                <Badge tone={t.status.includes('Menunggu')?'warning':'success'}>{t.status}</Badge>,
                <span style={{fontSize:12,color:'#888'}}>{t.messages[t.messages.length-1]?.at}</span>,
                <button className="btn btn-outline" style={{minHeight:28,padding:'2px 8px',fontSize:11}} onClick={()=>setViewTicket(t)}>
                  Buka Percakapan
                </button>
              ])}
            />
          </Panel>
        ) : (
          <Panel title="Daftar Usulan Fitur yang Dikirim" subtitle="Hanya menampilkan usulan dari organisasi Anda (PRD §10.8)">
            <DataTable
              caption="Daftar Usulan Fitur"
              headers={['ID','Nama Usulan Fitur','Modul Terkait','Dampak Komersial','Status Produk','Catatan Tim']}
              rows={s.features.map(f=>[
                <strong>{f.id}</strong>,
                <span style={{color:'#fff',fontWeight:600}}>{f.title}</span>,
                f.module,
                <span style={{fontSize:12,color:'#a3a3a3'}}>{f.commercialImpact || f.problem}</span>,
                <Badge tone={f.status==='Dirilis'?'success':f.status==='Direncanakan'?'info':'warning'}>{f.status}</Badge>,
                <span style={{fontSize:13,color:'#a3a3a3'}}>{f.update}</span>
              ])}
            />
          </Panel>
        )}
      </StateBoundary>

      {/* Modal Percakapan Tiket */}
      {viewTicket && (
        <Modal open={true} onClose={()=>setViewTicket(null)} title={`Percakapan Tiket: ${viewTicket.id}`} description={viewTicket.title}>
          <div className="stack" style={{gap:16}}>
            <div style={{display:'flex',gap:12,fontSize:12,color:'#a3a3a3',borderBottom:'1px solid #242424',paddingBottom:12}}>
              <span>Kategori: <strong>{viewTicket.category}</strong></span>
              <span>•</span>
              <span>Status: <strong style={{color:'#00a6ff'}}>{viewTicket.status}</strong></span>
            </div>

            <div className="timeline" style={{maxHeight:260,overflowY:'auto',paddingRight:6}}>
              {viewTicket.messages.filter((m: {internal: boolean})=>!m.internal).map((m: {author: string; at: string; body: string},i: number)=>(
                <div key={i} style={{marginBottom:14}}>
                  <strong style={{color:'#fff',fontSize:13}}>{m.author} <small style={{color:'#777',fontWeight:400}}>({m.at})</small>:</strong>
                  <p style={{marginTop:4,color:'#d4d4d4',fontSize:13,lineHeight:1.5}}>{m.body}</p>
                </div>
              ))}
            </div>

            <Field label="Tulis Balasan Tambahan" multiline value={ticketReply} onChange={e=>setTicketReply(e.target.value)}/>

            <div className="button-row" style={{justifyContent:'flex-end'}}>
              <Btn secondary onClick={()=>setViewTicket(null)}>Tutup</Btn>
              <Btn onClick={()=>handleReplyTicket(viewTicket.id)}>Kirim Balasan</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Tiket Baru */}
      <Modal open={createTicket} onClose={()=>setCreateTicket(false)} title="Buat Tiket Bantuan & Komplain Data">
        <form onSubmit={submitTicket} className="stack" style={{gap:16}}>
          <Field label="Judul Masalah / Pertanyaan" required value={tTitle} onChange={e=>setTTitle(e.target.value)}/>
          <Choice label="Kategori Masalah" value={tCat} onChange={setTCat} options={['Data proyek','Perhitungan gap nilai','Impor Excel','Tagihan Proyek & AR','Langganan COVE & Billing','Akses & Akun']}/>
          <Field label="Uraian Masalah & Langkah yang Dilakukan" multiline required value={tDesc} onChange={e=>setTDesc(e.target.value)}/>
          <Notice tone="info">
            Tim dukungan teknis COVE membalas dalam waktu maksimal 2 jam kerja pada jam operasional (08.00–18.00 WIB).
          </Notice>
          <div className="button-row" style={{justifyContent:'flex-end'}}>
            <Btn secondary onClick={()=>setCreateTicket(false)}>Batal</Btn>
            <Btn type="submit">Kirim Tiket Bantuan</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Usulan Fitur Baru: Explicit Prompt PRD §10.8 */}
      <Modal open={createFeature} onClose={()=>setCreateFeature(false)} title="Fitur apa yang Anda harapkan untuk aplikasi ini?">
        <form onSubmit={submitFeature} className="stack" style={{gap:16}}>
          <Field label="Judul Fitur yang Diharapkan" required placeholder="Contoh: Ekspor laporan mingguan per PIC QS" value={fTitle} onChange={e=>setFTitle(e.target.value)}/>
          <Choice label="Modul Terkait" value={fMod} onChange={setFMod} options={['Proyek','Progres & Klaim','Tindakan','Tagihan Proyek','Laporan','Impor Excel']}/>
          <Field label="Masalah apa yang ingin diselesaikan dengan fitur ini?" multiline required placeholder="Jelaskan kendala operasional yang Anda hadapi saat ini di lapangan..." value={fProb} onChange={e=>setFProb(e.target.value)}/>
          <Field label="Dampak Finansial / Komersial terhadap Kontrol Kas Proyek Anda" multiline placeholder="Contoh: Menghemat 3 jam rekapitulasi manual tiap periode klaim..." value={fImpact} onChange={e=>setFImpact(e.target.value)}/>
          <div className="button-row" style={{justifyContent:'flex-end'}}>
            <Btn secondary onClick={()=>setCreateFeature(false)}>Batal</Btn>
            <Btn type="submit">Kirim Usulan Fitur</Btn>
          </div>
        </form>
      </Modal>
    </>
  );
}
