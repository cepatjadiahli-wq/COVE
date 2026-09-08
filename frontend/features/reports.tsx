import {useState} from 'react';
import {Download,ArrowUpRight,CalendarDays,Clock3,AlertTriangle,CheckCircle2,TrendingUp,FileSpreadsheet} from 'lucide-react';
import {useRoute,Link} from '@/lib/router';
import {useStore} from '@/lib/store';
import {money,stageMetrics,sumStages,daysOverdue,STAGE_COLORS,STAGES,csvText,download} from '@/lib/domain';
import {PageHeading,Panel,Btn,Badge,TabSet,DataTable,StateBoundary,Choice} from '@/components/cove/ui';

export function ReportsView(){
  const s=useStore();
  const {query,go}=useRoute();
  const currentTab=query.get('type')||'portfolio';
  const activeProjects=s.projects.filter(p=>p.status==='Aktif');
  const values=sumStages(activeProjects);
  const m=stageMetrics(values);

  const exportAll=()=>{
    const rows=[
      ['Laporan Komersial COVE - Portfolio Proyek'],
      ['Tanggal', '8 Sep 2026'],
      [''],
      ['Proyek','Kontrak','Dikerjakan','Diukur','Diajukan','Disetujui','Ditagihkan','Diterima','Total Tertahan'],
      ...activeProjects.map(p=>[
        p.name,
        p.contract,
        p.values[0],
        p.values[1],
        p.values[2],
        p.values[3],
        p.values[4],
        p.values[5],
        stageMetrics(p.values).total
      ])
    ];
    download('cove-laporan-komersial-portfolio.csv', csvText(rows));
    s.setNotice('Laporan komersial berhasil diekspor.');
  };

  return (
    <>
      <PageHeading
        eyebrow="ANALISIS KOMERSIAL & AR"
        title="Laporan"
        description="Analisis kebocoran nilai, umur piutang, dan proyeksi penerimaan kas proyek."
        action={
          <Btn secondary onClick={exportAll}>
            <Download size={16}/> Ekspor Laporan CSV
          </Btn>
        }
      />

      <StateBoundary>
        <TabSet
          value={currentTab}
          onChange={v=>go('/reports?type='+v)}
          items={[
            {
              id:'portfolio',
              label:'Ringkasan Portofolio',
              content:<PortfolioTab projects={activeProjects} values={values} m={m}/>
            },
            {
              id:'gaps',
              label:'Analisis Gap G1–G5',
              content:<ValueGapsTab projects={activeProjects}/>
            },
            {
              id:'aging',
              label:'Aging & Cycle Time',
              content:<AgingTab projects={activeProjects}/>
            },
            {
              id:'forecast',
              label:'Rencana Kas (Forecast)',
              content:<ForecastTab projects={activeProjects} m={m}/>
            }
          ]}
        />
      </StateBoundary>
    </>
  );
}

function PortfolioTab({projects,values,m}:{projects:any[];values:any;m:any}){
  return (
    <div className="stack" style={{gap:20}}>
      <div className="metric-grid">
        <div className="metric-card cyan">
          <div className="metric-top"><span>Total Kontrak Aktif</span><FileSpreadsheet size={16}/></div>
          <strong className="metric-value">{money(projects.reduce((v,p)=>v+p.contract,0),true)}</strong>
          <div className="metric-bottom"><span>{projects.length} proyek konstruksi aktif</span></div>
        </div>
        <div className="metric-card purple">
          <div className="metric-top"><span>Total Belum Ditagihkan</span><TrendingUp size={16}/></div>
          <strong className="metric-value">{money(m.unbilled,true)}</strong>
          <div className="metric-bottom"><span>Pekerjaan s.d. disetujui</span></div>
        </div>
        <div className="metric-card yellow">
          <div className="metric-top"><span>Total Piutang Proyek (AR)</span><Clock3 size={16}/></div>
          <strong className="metric-value">{money(m.receivable,true)}</strong>
          <div className="metric-bottom"><span>Ditagihkan - Diterima</span></div>
        </div>
        <div className="metric-card red">
          <div className="metric-top"><span>Total Nilai Tertahan</span><AlertTriangle size={16}/></div>
          <strong className="metric-value">{money(m.total,true)}</strong>
          <div className="metric-bottom"><span>Σ Gap G1–G5</span></div>
        </div>
      </div>

      <Panel title="Tabel Komparasi Proyek Aktif" subtitle="Nilai kumulatif principal per 8 Sep 2026">
        <DataTable
          caption="Tabel Komparasi Portofolio Proyek"
          headers={['Proyek','Kontrak','Dikerjakan','Ditagihkan','Diterima','Total Tertahan','Rasio Diterima']}
          rows={projects.map(p=>{
            const sm=stageMetrics(p.values);
            const ratio=p.values[0]>0?Math.round((p.values[5]/p.values[0])*100):0;
            return [
              <Link className="record-link" href={'/projects/'+p.id}>
                <strong>{p.name}</strong>
                <small>{p.code} · {p.owner}</small>
              </Link>,
              money(p.contract,true),
              money(p.values[0],true),
              money(p.values[4],true),
              money(p.values[5],true),
              <strong style={{color:'#fda4af'}}>{money(sm.total,true)}</strong>,
              <Badge tone={ratio>=70?'success':ratio>=40?'warning':'neutral'}>{ratio}%</Badge>
            ];
          })}
        />
      </Panel>
    </div>
  );
}

function ValueGapsTab({projects}:{projects:any[]}){
  const gapLabels=[
    {code:'G1',title:'Belum diukur',desc:'Dikerjakan − Diukur (Opname lapangan belum tercatat)'},
    {code:'G2',title:'Belum diajukan',desc:'Diukur − Diajukan (Klaim volume belum diajukan ke MK)'},
    {code:'G3',title:'Belum disetujui',desc:'Diajukan − Disetujui (Menunggu persetujuan sertifikat termin)'},
    {code:'G4',title:'Belum ditagihkan',desc:'Disetujui − Ditagihkan (Sertifikat siap diterbitkan invoice)'},
    {code:'G5',title:'Belum diterima',desc:'Ditagihkan − Diterima (Piutang invoice proyek berjalan)'}
  ];

  return (
    <div className="stack" style={{gap:20}}>
      <div className="gap-grid">
        {gapLabels.map((g,i)=>{
          const totalGap=projects.reduce((sum,p)=>sum+stageMetrics(p.values).gaps[i],0);
          return (
            <div key={g.code} className="gap-card">
              <span style={{color:STAGE_COLORS[i]}}>{g.code} · {g.title}</span>
              <strong>{money(totalGap,true)}</strong>
              <p style={{fontSize:12,color:'#888',margin:0}}>{g.desc}</p>
            </div>
          );
        })}
      </div>

      <Panel title="Rincian Gap per Proyek" subtitle="Titik sumbatan nilai komersial">
        <DataTable
          caption="Rincian Gap per Proyek"
          headers={['Proyek','G1 (Belum Diukur)','G2 (Belum Diajukan)','G3 (Belum Disetujui)','G4 (Belum Ditagihkan)','G5 (Piutang)','Status']}
          rows={projects.map(p=>{
            const sm=stageMetrics(p.values);
            return [
              <Link className="record-link" href={'/projects/'+p.id}>
                <strong>{p.name}</strong>
              </Link>,
              money(sm.gaps[0],true),
              money(sm.gaps[1],true),
              money(sm.gaps[2],true),
              money(sm.gaps[3],true),
              money(sm.gaps[4],true),
              <Badge tone={sm.identityValid?'success':'danger'}>{sm.identityValid?'Valid':'Perlu Rekonsiliasi'}</Badge>
            ];
          })}
        />
      </Panel>
    </div>
  );
}

function AgingTab({projects}:{projects:any[]}){
  const s=useStore();
  const invoices=s.invoices;

  const notDue=invoices.filter(i=>daysOverdue(i.due)===0 && i.paid<i.principal);
  const overdue1to30=invoices.filter(i=>{const d=daysOverdue(i.due); return d>0 && d<=30 && i.paid<i.principal;});
  const overdueOver30=invoices.filter(i=>{const d=daysOverdue(i.due); return d>30 && i.paid<i.principal;});

  const sumRemaining=(list:any[])=>list.reduce((sum,i)=>sum+i.principal-i.paid,0);

  return (
    <div className="stack" style={{gap:20}}>
      <div className="two-col">
        <Panel title="Distribusi Umur Piutang (Aging)" subtitle="Berdasarkan sisa pokok invoice proyek">
          <div className="panel-padding stack" style={{gap:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Belum Jatuh Tempo (&lt;30 hari)</span>
              <strong style={{color:'#6ee7b7'}}>{money(sumRemaining(notDue),true)}</strong>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Terlambat 1–30 Hari</span>
              <strong style={{color:'#fcd34d'}}>{money(sumRemaining(overdue1to30),true)}</strong>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Terlambat &gt;30 Hari</span>
              <strong style={{color:'#fda4af'}}>{money(sumRemaining(overdueOver30),true)}</strong>
            </div>
          </div>
        </Panel>

        <Panel title="Rata-rata Waktu Siklus (Cycle Time)" subtitle="Kecepatan pergerakan nilai antar-tahap">
          <div className="panel-padding stack" style={{gap:14}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>Opname ke Pengajuan Klaim</span>
              <strong>12 hari</strong>
            </div>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>Persetujuan MK / Sertifikasi</span>
              <strong>14 hari</strong>
            </div>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>Sertifikat ke Terbit Invoice</span>
              <strong>5 hari</strong>
            </div>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>Jatuh Tempo ke Penerimaan Kas</span>
              <strong style={{color:'#fda4af'}}>38 hari (Overdue)</strong>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Daftar Invoice Lewat Jatuh Tempo">
        <DataTable
          caption="Invoice Lewat Jatuh Tempo"
          headers={['Nomor Invoice','Proyek','Sisa Pokok','Jatuh Tempo','Terlambat','Tindakan']}
          rows={invoices.filter(i=>daysOverdue(i.due)>0 && i.paid<i.principal).map(i=>[
            <strong>{i.number}</strong>,
            s.projects.find(p=>p.id===i.projectId)?.name,
            <strong style={{color:'#fda4af'}}>{money(i.principal-i.paid)}</strong>,
            i.due,
            <Badge tone="danger">{daysOverdue(i.due)} hari</Badge>,
            <Link className="btn btn-outline" style={{minHeight:30,padding:'4px 10px',fontSize:12}} href={'/invoices?item='+i.id}>
              Buka Penagihan
            </Link>
          ])}
        />
      </Panel>
    </div>
  );
}

function ForecastTab({projects,m}:{projects:any[];m:any}){
  const s=useStore();
  const incoming=[
    {due:'15 Sep 2026',project:'Gedung Meridian',inv:'INV/MRD/2026/004',val:70000000,prob:'Tinggi',note:'Klien BUMN telah menerbitkan SPK termin'},
    {due:'19 Sep 2026',project:'Logistik Cakrawala',inv:'INV/CKR/2026/007',val:200000000,prob:'Sedang',note:'Menunggu konfirmasi jadwal Finance'},
    {due:'24 Sep 2026',project:'MEP Rumah Sakit Aruna',inv:'INV/ARN/2026/004',val:100000000,prob:'Tinggi',note:'Verifikasi dokumen klaim selesai'}
  ];

  return (
    <div className="stack" style={{gap:20}}>
      <Panel title="Proyeksi Penerimaan Kas 30 Hari Ke Depan" subtitle="Total estimasi kas masuk: Rp370 Juta">
        <div className="panel-padding">
          <div style={{display:'flex',alignItems:'baseline',gap:16,marginBottom:16}}>
            <span style={{fontSize:14,color:'#a3a3a3'}}>Total Proyeksi 30 Hari:</span>
            <strong style={{fontSize:28,fontWeight:800,color:'#00a6ff'}}>Rp370.000.000</strong>
            <Badge tone="info">Keyakinan Sedang</Badge>
          </div>
          <DataTable
            caption="Jadwal Estimasi Kas Masuk"
            headers={['Tanggal Estimasi','Proyek','Referensi Tagihan','Perkiraan Nilai','Keyakinan','Catatan Konfirmasi']}
            rows={incoming.map(row=>[
              row.due,
              row.project,
              <strong>{row.inv}</strong>,
              <strong>{money(row.val)}</strong>,
              <Badge tone={row.prob==='Tinggi'?'success':'warning'}>{row.prob}</Badge>,
              <span style={{fontSize:13,color:'#a3a3a3'}}>{row.note}</span>
            ])}
          />
        </div>
      </Panel>
    </div>
  );
}
