import {useState} from 'react';
import {
  ShieldCheck,Activity,CreditCard,MessageSquare,Lightbulb,SlidersHorizontal,
  TrendingUp,Users,Building2,CheckCircle2,Clock3,AlertTriangle,Send,Download,RefreshCw,ArrowUpRight
} from 'lucide-react';
import {Link,useRoute} from '@/lib/router';
import {useStore} from '@/lib/store';
import {money,type RecoveryLead} from '@/lib/domain';
import {PageHeading,Panel,Btn,Badge,DataTable,Field,Choice,Notice,Modal} from '@/components/cove/ui';

export function AdminOverview(){
  const s=useStore();
  return (
    <>
      <PageHeading
        eyebrow="OPERASI BISNIS SAAS"
        title="Ringkasan SaaS"
        description="Metrik pendapatan berulang, retensi pelanggan, dan kesehatan platform COVE."
        action={<Badge tone="info">COVE Admin · Internal</Badge>}
      />

      <div className="metric-grid">
        <div className="metric-card cyan">
          <div className="metric-top"><span>MRR (Monthly Recurring)</span><TrendingUp size={16}/></div>
          <strong className="metric-value">Rp142,5 Jt</strong>
          <div className="metric-bottom"><span>ARR: Rp1,71 Miliar</span></div>
        </div>
        <div className="metric-card purple">
          <div className="metric-top"><span>Pelanggan Aktif</span><Building2 size={16}/></div>
          <strong className="metric-value">29 PT</strong>
          <div className="metric-bottom"><span>+4 perusahaan bulan ini</span></div>
        </div>
        <div className="metric-card yellow">
          <div className="metric-top"><span>Tingkat Churn</span><Activity size={16}/></div>
          <strong className="metric-value">1,2%</strong>
          <div className="metric-bottom"><span>Target &lt; 2,0%</span></div>
        </div>
        <div className="metric-card red">
          <div className="metric-top"><span>Kesehatan Sistem</span><ShieldCheck size={16}/></div>
          <strong className="metric-value">99,9%</strong>
          <div className="metric-bottom"><span>Webhook Mayar 210ms</span></div>
        </div>
      </div>

      <Panel title="Daftar Pelanggan Aktif Terbaru" subtitle="Tenant terdaftar pada platform COVE">
        <DataTable
          caption="Pelanggan SaaS COVE"
          headers={['Perusahaan Kontraktor','Paket','Proyek Terpakai','Nilai MRR','Status Akun','Pembaruan']}
          rows={[
            ['PT Ruang Karya Konstruksi','Core (3 Proyek)','3 / 3 (100%)',money(4900000),<Badge tone="success">Aktif</Badge>,'8 Sep 2026'],
            ['PT Wijaya Karya Spesialis','Scale (10 Proyek)','7 / 10 (70%)',money(9900000),<Badge tone="success">Aktif</Badge>,'7 Sep 2026'],
            ['PT Bangun Megah Nusantara','Paid Pilot (45h)','1 / 1 (100%)',money(7500000),<Badge tone="warning">Pilot Hari ke-32</Badge>,'6 Sep 2026'],
            ['PT Cipta Sarana Mandiri','Core (3 Proyek)','2 / 3 (66%)',money(4900000),<Badge tone="success">Aktif</Badge>,'5 Sep 2026']
          ]}
        />
      </Panel>
    </>
  );
}

export function AdminBilling(){
  const s=useStore();
  const webhooks=[
    {id:'evt_mayar_99182',event:'payment.settled',ref:'COV-PAY-8821',tenant:'PT Ruang Karya Konstruksi',amount:4900000,status:'Success',time:'8 Sep 08:32 WIB'},
    {id:'evt_mayar_99181',event:'payment.settled',ref:'COV-PAY-8819',tenant:'PT Cipta Sarana Mandiri',amount:4900000,status:'Success',time:'7 Sep 15:10 WIB'},
    {id:'evt_mayar_99180',event:'payment.expired',ref:'COV-PAY-8815',tenant:'PT Mitra Perkasa Steel',amount:7500000,status:'Handled',time:'6 Sep 23:59 WIB'}
  ];

  return (
    <>
      <PageHeading
        eyebrow="GERBANG PEMBAYARAN SAAS"
        title="Langganan & Pembayaran"
        description="Log webhook Mayar, rekonsiliasi pembayaran, dan kontrol subscription."
        action={<Badge tone="info">Gateway: Mayar Production</Badge>}
      />

      <Panel title="Log Webhook Mayar Terakhir" subtitle="Penerimaan callback transaksi secara real-time">
        <DataTable
          caption="Log Webhook Mayar"
          headers={['Event ID','Tipe Event','Referensi Order','Tenant','Nominal','Status Handler','Waktu']}
          rows={webhooks.map(w=>[
            <code>{w.id}</code>,
            <Badge tone="info">{w.event}</Badge>,
            w.ref,
            w.tenant,
            money(w.amount),
            <Badge tone="success">{w.status}</Badge>,
            w.time
          ])}
        />
      </Panel>

      <Panel title="Rekonsiliasi & Dispute Control" subtitle="Pemeriksaan integritas antara Mayar dan ledger akun pelanggan">
        <div className="panel-padding">
          <Notice tone="success">
            Seluruh transaksi 7 hari terakhir (14 pembayaran terverifikasi) telah cocok 100% dengan status subscription tenant.
          </Notice>
        </div>
      </Panel>
    </>
  );
}

export function AdminRecovery(){
  const s=useStore();
  const [selectedLead,setSelectedLead]=useState<RecoveryLead|null>(null);

  const handleMarkContacted=(id:string)=>{
    s.setRecoveryLeads(leads=>leads.map(l=>l.id===id?{...l,contacted:true}:l));
    s.setNotice('Prospek ditandai telah dihubungi secara manual.');
    setSelectedLead(null);
  };

  return (
    <>
      <PageHeading
        eyebrow="GROWTH & PROSPEK SAAS"
        title="Prospek & Recovery Manual"
        description="Pemantauan prospek checkout yang belum lunas dan bantuan operasional berizin (PRD §24)."
      />

      {/* Audit Compliance Banner */}
      <div style={{marginBottom:20}}>
        <Notice tone="warning">
          <strong>Kepatuhan Audit PRD §24 & DESIGN §8.4:</strong> Chatbot WhatsApp otomatis berstatus <strong>LATER (Phase 20F)</strong> dan dinonaktifkan di tahap awal. Tindak lanjut prospek dilakukan secara <strong>manual</strong> oleh staf sales berwenang menggunakan template pesan resmi berizin via WhatsApp (click-to-chat). Kontak pemilik proyek atau MK dari domain proyek dilarang keras dipungut sebagai prospek marketing.
        </Notice>
      </div>

      <div className="metric-grid">
        <div className="metric-card yellow">
          <div className="metric-top"><span>Abandon Rate Checkout</span><Clock3 size={16}/></div>
          <strong className="metric-value">24,5%</strong>
          <div className="metric-bottom"><span>Target &lt; 20% · Sesi Publik</span></div>
        </div>
        <div className="metric-card cyan">
          <div className="metric-top"><span>Tingkat Pemulihan (Manual)</span><CheckCircle2 size={16}/></div>
          <strong className="metric-value">62,8%</strong>
          <div className="metric-bottom"><span>Follow-up manual berizin</span></div>
        </div>
      </div>

      <Panel title="Daftar Prospek Checkout Belum Lunas" subtitle="Hanya prospek dengan status consent aktif yang diizinkan untuk dihubungi">
        <DataTable
          caption="Unpaid Leads"
          headers={['Calon Pelanggan','Perusahaan','Paket Pilihan','Kendala Checkout','Status Izin (Consent)','Tindakan Manual']}
          rows={s.recoveryLeads.map(l=>[
            <div>
              <strong style={{color:'#fff'}}>{l.name}</strong>
              <small style={{display:'block',color:'#888'}}>{l.phone}</small>
            </div>,
            l.company,
            <Badge tone="info">{l.plan}</Badge>,
            <span style={{fontSize:13,color:'#fda4af'}}>{l.reason}</span>,
            l.consentStatus==='GRANTED' ? (
              <Badge tone="success">Izin Diberikan</Badge>
            ) : l.consentStatus==='SUPPRESSED' ? (
              <Badge tone="danger">Opt-Out / Suppressed</Badge>
            ) : (
              <Badge tone="warning">Belum Ada Izin</Badge>
            ),
            l.contacted ? (
              <Badge tone="neutral">Sudah Dihubungi</Badge>
            ) : l.consentStatus==='GRANTED' ? (
              <button className="btn btn-outline" style={{minHeight:28,padding:'2px 8px',fontSize:11}} onClick={()=>setSelectedLead(l)}>
                Buka Template WA
              </button>
            ) : (
              <span style={{fontSize:11,color:'#737373',fontStyle:'italic'}}>Dilarang Dihubungi</span>
            )
          ])}
        />
      </Panel>

      {/* Manual WhatsApp Template Modal */}
      {selectedLead && (
        <Modal open={true} onClose={()=>setSelectedLead(null)} title="Template Tindak Lanjut WhatsApp Manual" description="Kirimkan pesan personal secara manual melalui akun WhatsApp resmi COVE.">
          <div className="stack" style={{gap:16}}>
            <dl className="key-values">
              <dt>Calon Pelanggan</dt>
              <dd>{selectedLead.name} ({selectedLead.company})</dd>
              <dt>Nomor Telepon</dt>
              <dd>{selectedLead.phone}</dd>
              <dt>Paket Dipilih</dt>
              <dd>Paket {selectedLead.plan}</dd>
            </dl>

            <div style={{padding:16,background:'#161616',borderRadius:8,border:'1px solid #292929'}}>
              <strong style={{fontSize:13,color:'#fafafa',display:'block',marginBottom:8}}>Draf Pesan Resmi:</strong>
              <p style={{fontSize:13,color:'#d4d4d4',lineHeight:1.6,margin:0,whiteSpace:'pre-line'}}>
                {`Halo Pak/Ibu ${selectedLead.name}, kami dari tim layanan COVE.\n\nKami melihat Anda memilih paket ${selectedLead.plan} untuk ${selectedLead.company}, namun proses checkout belum terselesaikan. Apakah ada kendala verifikasi pembayaran atau hal yang bisa kami bantu jelaskan?\n\n(Balas STOP jika Anda tidak berkenan menerima pesan tindak lanjut ini).`}
              </p>
            </div>

            <Notice tone="info">
              Tautan di bawah membuka WhatsApp Web atau aplikasi desktop Anda secara langsung dengan teks yang telah diisi. Pesan tidak dikirim otomatis oleh bot server.
            </Notice>

            <div className="button-row" style={{justifyContent:'flex-end'}}>
              <Btn secondary onClick={()=>setSelectedLead(null)}>Batal</Btn>
              <a
                className="btn btn-white"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/${selectedLead.phoneClean}?text=${encodeURIComponent(
                  `Halo Pak/Ibu ${selectedLead.name}, kami dari tim layanan COVE. Kami melihat Anda memilih paket ${selectedLead.plan} untuk ${selectedLead.company}, namun proses checkout belum terselesaikan. Apakah ada kendala verifikasi pembayaran atau hal yang bisa kami bantu jelaskan? (Balas STOP jika tidak berkenan menerima pesan ini).`
                )}`}
                onClick={()=>handleMarkContacted(selectedLead.id)}
              >
                Buka WhatsApp (Manual) <ArrowUpRight size={15}/>
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AdminSupport(){
  const s=useStore();
  const [selectedTicket,setSelectedTicket]=useState<string|null>(null);
  const [replyText,setReplyText]=useState('');
  const [isInternal,setIsInternal]=useState(false);

  const handleReply=()=>{
    if(!replyText.trim()) return;
    s.setTickets(tickets=>tickets.map(t=>t.id===selectedTicket?{
      ...t,
      status:isInternal?t.status:'Menunggu Anda',
      messages:[
        ...t.messages,
        {
          body:replyText,
          author:isInternal?'Catatan Internal Admin':'Nadia · Tim Dukungan COVE',
          internal:isInternal,
          at:'8 Sep, 09.45'
        }
      ]
    }:t));
    s.setNotice('Balasan berhasil ditambahkan ke tiket '+selectedTicket+'.');
    setReplyText('');
  };

  return (
    <>
      <PageHeading
        eyebrow="LAYANAN PELANGGAN"
        title="Dukungan Pelanggan"
        description="Antrean tiket masuk dari seluruh tenant kontraktor, penugasan agent, dan histori percakapan."
      />

      <Panel title="Antrean Tiket Masuk">
        <DataTable
          caption="Support Queue"
          headers={['ID Tiket','Judul Masalah','Kategori','Prioritas','Status','Aksi']}
          rows={s.tickets.map(t=>[
            <code>{t.id}</code>,
            <span style={{color:'#fff',fontWeight:600}}>{t.title}</span>,
            t.category,
            <Badge tone={t.priority==='P1'?'danger':'warning'}>{t.priority}</Badge>,
            <Badge tone={t.status.includes('Menunggu')?'warning':'success'}>{t.status}</Badge>,
            <button className="btn btn-outline" style={{minHeight:28,padding:'2px 8px',fontSize:11}} onClick={()=>setSelectedTicket(t.id)}>
              Buka Percakapan
            </button>
          ])}
        />
      </Panel>

      {selectedTicket && (
        <Panel title={'Percakapan Tiket: '+selectedTicket} subtitle="Balasan publik terlihat oleh pelanggan; catatan internal hanya untuk tim COVE">
          <div className="panel-padding stack" style={{gap:16}}>
            <div className="timeline">
              {s.tickets.find(t=>t.id===selectedTicket)?.messages.map((m,i)=>(
                <div key={i} style={m.internal?{background:'#222',padding:8,borderRadius:6}:undefined}>
                  <span style={m.internal?{background:'#fbbf24'}:undefined}/>
                  <strong>{m.author} <small style={{color:'#888',fontWeight:400}}>({m.at})</small>:</strong>
                  <p style={{marginTop:4,color:m.internal?'#fbbf24':'#d4d4d4'}}>{m.body}</p>
                </div>
              ))}
            </div>

            <Field label="Tulis Balasan / Catatan" multiline value={replyText} onChange={e=>setReplyText(e.target.value)}/>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <input type="checkbox" id="int-check" checked={isInternal} onChange={e=>setIsInternal(e.target.checked)}/>
              <label htmlFor="int-check" style={{fontSize:13,color:'#a3a3a3'}}>Tandai sebagai Catatan Internal (Pelanggan tidak melihat ini)</label>
            </div>
            <div className="button-row">
              <Btn onClick={handleReply}><Send size={15}/> Kirim Balasan</Btn>
              <Btn secondary onClick={()=>setSelectedTicket(null)}>Tutup</Btn>
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}

export function AdminFeatures(){
  const s=useStore();
  const updateStatus=(id:string,newStatus:string)=>{
    s.setFeatures(feats=>feats.map(f=>f.id===id?{...f,status:newStatus}:f));
    s.setNotice('Status usulan '+id+' diperbarui menjadi '+newStatus+'.');
  };

  return (
    <>
      <PageHeading
        eyebrow="ROADMAP PRODUK"
        title="Usulan Fitur"
        description="Canonical backlog permintaan fitur dari seluruh pelanggan kontraktor."
      />

      <Panel title="Backlog Usulan Fitur">
        <DataTable
          caption="Feature Requests Backlog"
          headers={['ID Usulan','Judul Usulan','Modul','Masalah / Justifikasi','Status','Ubah Status']}
          rows={s.features.map(f=>[
            <code>{f.id}</code>,
            <span style={{color:'#fff',fontWeight:600}}>{f.title}</span>,
            f.module,
            <span style={{fontSize:13,color:'#888'}}>{f.problem}</span>,
            <Badge tone={f.status==='Dirilis'?'success':f.status==='Direncanakan'?'info':'warning'}>{f.status}</Badge>,
            <select
              style={{background:'#161616',color:'#fff',border:'1px solid #333',padding:'4px 8px',borderRadius:6,fontSize:12}}
              value={f.status}
              onChange={e=>updateStatus(f.id,e.target.value)}
            >
              <option value="Ditinjau">Ditinjau</option>
              <option value="Direncanakan">Direncanakan</option>
              <option value="Dikerjakan">Dikerjakan</option>
              <option value="Dirilis">Dirilis</option>
            </select>
          ])}
        />
      </Panel>
    </>
  );
}

export function AdminSettings(){
  return (
    <>
      <PageHeading
        eyebrow="SISTEM & INTEGRASI"
        title="Pengaturan Platform"
        description="Konfigurasi API gateway Mayar, Meta Pixel/CAPI, dan immutable audit log."
      />

      <div className="two-col">
        <Panel title="Integrasi Gateway & Pengukuran Konversi">
          <div className="panel-padding stack" style={{gap:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <strong>Mayar Payment Gateway</strong>
                <p style={{fontSize:12,color:'#888'}}>Mekanisme penagihan SaaS langganan COVE (Terisolasi dari kas proyek)</p>
              </div>
              <Badge tone="success">Terhubung</Badge>
            </div>

            <div style={{borderTop:'1px solid #242424',paddingTop:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div>
                  <strong>Meta Pixel & Conversions API (CAPI Outbox)</strong>
                  <p style={{fontSize:12,color:'#888'}}>Pengukuran sisi server (PRD §26 & ERD §27)</p>
                </div>
                <Badge tone="info">Allowlist Aktif</Badge>
              </div>

              <div style={{background:'#161616',padding:12,borderRadius:8,fontSize:12,color:'#a3a3a3',lineHeight:1.6}}>
                <strong style={{color:'#fafafa',display:'block',marginBottom:4}}>Kebijakan Isolasi & Privasi:</strong>
                • <strong>Hanya Halaman Publik:</strong> Event diizinkan hanya pada rute <code>/</code>, <code>/cara-kerja</code>, <code>/pricing</code>, dan <code>/checkout</code>.<br/>
                • <strong>Zero Tracking di Workspace:</strong> Dilarang keras ada pelacakan pada area kerja proyek (<code>/dashboard</code>, <code>/projects</code>, <code>/invoices</code>) atau konsol admin.<br/>
                • <strong>Allowlist Standar:</strong> Hanya <code>PageView</code>, <code>ViewContent</code>, <code>InitiateCheckout</code>, dan <code>Purchase</code>.<br/>
                • <strong>Enkripsi:</strong> Seluruh data identitas di-hash SHA256 sebelum masuk ke tabel <code>conversion_outbox_events</code>.
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Audit Log Admin">
          <div className="panel-padding stack" style={{gap:12}}>
            <div style={{fontSize:13,color:'#a3a3a3'}}>
              <strong>8 Sep 08:30</strong> · Operator superadmin mengubah status tenant PT Ruang Karya Konstruksi menjadi Aktif.
            </div>
            <div style={{fontSize:13,color:'#a3a3a3'}}>
              <strong>7 Sep 14:15</strong> · Operator superadmin memverifikasi webhook Mayar settlement ID 99181.
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
