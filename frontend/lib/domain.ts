export const AS_OF = '2026-09-08';
export const STAGES = ['Dikerjakan','Diukur','Diajukan','Disetujui','Ditagihkan','Diterima'] as const;
export const STAGE_COLORS = ['#FBBF24','#38BDF8','#A78BFA','#2DD4BF','#60A5FA','#34D399'];
export type StageValues = [number,number,number,number,number,number];
export type Project = {id:string; code:string; name:string; customer:string; location:string; owner:string; status:'Aktif'|'Diarsipkan'; contract:number; values:StageValues; updated:string};
export type Action = {id:string;projectId:string;title:string;blocker:string;owner:string;due:string;severity:'Tinggi'|'Sedang'|'Rendah';value:number;status:'Terbuka'|'Menunggu'|'Selesai';notes:string[]};
export type Invoice = {id:string;projectId:string;number:string;principal:number;paid:number;issued:string;due:string;status:'Terbit'|'Draf'|'Disengketakan';certificate:string};
export type Ticket = {id:string;title:string;category:string;status:string;priority:string;messages:{body:string;author:string;internal:boolean;at:string}[];rating?:number};
export type Feature = {id:string;title:string;problem:string;module:string;status:string;update:string;commercialImpact?:string;priority?:'P1'|'P2'|'P3'|'LATER'};
export type RecoveryLead = {id:string;name:string;company:string;plan:string;phone:string;phoneClean:string;abandonAt:string;reason:string;consentStatus:'GRANTED'|'MISSING'|'SUPPRESSED';contacted:boolean};
export type DocumentRecord = {id:string;projectId:string;name:string;kind:string;version:number;date:string;owner:string;status:string};
export const projectsSeed:Project[] = [
 {id:'p1',code:'COV-001',name:'Gedung Meridian',customer:'PT Meridian Properti',location:'Jakarta Selatan',owner:'Andi Pratama',status:'Aktif',contract:15000000000,values:[1200000000,1050000000,900000000,750000000,600000000,450000000],updated:'8 Sep 2026, 09.15'},
 {id:'p2',code:'COV-002',name:'Logistik Cakrawala',customer:'PT Cakrawala Logistik',location:'Bekasi, Jawa Barat',owner:'Sari Wulandari',status:'Aktif',contract:24000000000,values:[3200000000,2900000000,2700000000,2400000000,2100000000,1600000000],updated:'8 Sep 2026, 08.40'},
 {id:'p3',code:'COV-003',name:'MEP Rumah Sakit Aruna',customer:'Yayasan Aruna Sehat',location:'Bandung, Jawa Barat',owner:'Budi Santoso',status:'Aktif',contract:8000000000,values:[1800000000,1650000000,1450000000,1250000000,1050000000,800000000],updated:'7 Sep 2026, 16.20'},
 {id:'p4',code:'COV-004',name:'Pabrik Nusa Industri',customer:'PT Nusa Industri',location:'Karawang, Jawa Barat',owner:'Andi Pratama',status:'Diarsipkan',contract:5000000000,values:[5000000000,5000000000,5000000000,5000000000,5000000000,5000000000],updated:'31 Agu 2026, 10.00'}
];
export const actionsSeed:Action[] = [
 {id:'a1',projectId:'p1',title:'Lengkapi dokumen opname',blocker:'Berita acara belum ditandatangani',owner:'Andi Pratama',due:'2026-09-07',severity:'Tinggi',value:150000000,status:'Terbuka',notes:['7 Sep · QS mengunggah hasil pengukuran. Menunggu tanda tangan PM.']},
 {id:'a2',projectId:'p2',title:'Tindak lanjuti persetujuan klaim Agustus',blocker:'Review quantity oleh MK',owner:'Sari Wulandari',due:'2026-09-08',severity:'Tinggi',value:300000000,status:'Menunggu',notes:['6 Sep · Klaim diterima tim MK.']},
 {id:'a3',projectId:'p3',title:'Terbitkan invoice sertifikat termin 04',blocker:'Invoice belum dibuat',owner:'Dewi Lestari',due:'2026-09-09',severity:'Sedang',value:200000000,status:'Terbuka',notes:[]},
 {id:'a4',projectId:'p2',title:'Konfirmasi jadwal pembayaran termin 06',blocker:'Pembayaran melewati jatuh tempo',owner:'Dewi Lestari',due:'2026-09-06',severity:'Tinggi',value:300000000,status:'Terbuka',notes:['5 Sep · Janji bayar belum dikonfirmasi ulang.']},
 {id:'a5',projectId:'p1',title:'Periksa kelengkapan sertifikat termin 03',blocker:'Lampiran sertifikat',owner:'Budi Santoso',due:'2026-09-10',severity:'Rendah',value:150000000,status:'Selesai',notes:['8 Sep · Sertifikat dan lampiran cocok dengan nilai disetujui.']}
];
export const invoicesSeed:Invoice[] = [
 {id:'i1',projectId:'p1',number:'INV/MRD/2026/003',principal:300000000,paid:220000000,issued:'2026-07-20',due:'2026-08-19',status:'Terbit',certificate:'BAP-MRD-003'},
 {id:'i2',projectId:'p1',number:'INV/MRD/2026/004',principal:300000000,paid:230000000,issued:'2026-08-25',due:'2026-09-24',status:'Terbit',certificate:'BAP-MRD-004'},
 {id:'i3',projectId:'p2',number:'INV/CKR/2026/006',principal:1200000000,paid:900000000,issued:'2026-07-18',due:'2026-08-17',status:'Terbit',certificate:'BAP-CKR-006'},
 {id:'i4',projectId:'p2',number:'INV/CKR/2026/007',principal:900000000,paid:700000000,issued:'2026-08-20',due:'2026-09-19',status:'Terbit',certificate:'BAP-CKR-007'},
 {id:'i5',projectId:'p3',number:'INV/ARN/2026/003',principal:600000000,paid:450000000,issued:'2026-07-25',due:'2026-08-24',status:'Terbit',certificate:'BAP-ARN-003'},
 {id:'i6',projectId:'p3',number:'INV/ARN/2026/004',principal:450000000,paid:350000000,issued:'2026-08-20',due:'2026-09-19',status:'Terbit',certificate:'BAP-ARN-004'}
];
export const documentsSeed:DocumentRecord[] = [
 {id:'d1',projectId:'p1',name:'Berita Acara Opname — Agustus 2026',kind:'Opname',version:2,date:'2026-09-07',owner:'Andi Pratama',status:'Menunggu tanda tangan'},
 {id:'d2',projectId:'p1',name:'Sertifikat Pembayaran Termin 03',kind:'Sertifikat',version:1,date:'2026-08-18',owner:'Sari Wulandari',status:'Lengkap'},
 {id:'d3',projectId:'p1',name:'Kontrak Induk — Gedung Meridian',kind:'Kontrak',version:1,date:'2026-01-05',owner:'Budi Santoso',status:'Lengkap'},
 {id:'d4',projectId:'p2',name:'Rekap Volume Klaim Agustus',kind:'Klaim',version:3,date:'2026-09-06',owner:'Sari Wulandari',status:'Lengkap'}
];
export const ticketsSeed:Ticket[] = [{id:'TKT-001',title:'Bagaimana mengoreksi pemetaan kolom impor?',category:'Data proyek',status:'Menunggu Anda',priority:'P3',messages:[{body:'Kolom nilai kontrak terbaca sebagai teks. Bagaimana cara memperbaikinya?',author:'Anda',internal:false,at:'7 Sep, 10.20'},{body:'Pada langkah pemetaan, pilih kolom yang berisi angka tanpa simbol Rp. Preview akan menandai baris yang perlu diperiksa sebelum disimpan.',author:'Nadia · Tim COVE',internal:false,at:'7 Sep, 11.05'}]}];
export const featuresSeed:Feature[] = [{id:'USL-001',title:'Ekspor laporan mingguan per PIC',problem:'Membagikan daftar tindakan tiap QS masih dilakukan manual.',module:'Laporan',status:'Ditinjau',update:'Tim produk sedang mempelajari format laporan yang dibutuhkan.',commercialImpact:'Menghemat 2 jam persiapan rapat komersial tiap Senin.',priority:'P2'}];
export const recoveryLeadsSeed:RecoveryLead[] = [
  {id:'lead-01',name:'Ir. Hendra Wijaya',company:'PT Pilar Utama Konstruksi',plan:'Core',phone:'+62 812-9988-1122',phoneClean:'6281299881122',abandonAt:'7 Sep 2026, 14.20',reason:'Checkout belum dibayar',consentStatus:'GRANTED',contacted:false},
  {id:'lead-02',name:'Bambang Sudibyo',company:'PT Megatama Sarana',plan:'Paid Pilot',phone:'+62 811-2233-4455',phoneClean:'6281122334455',abandonAt:'6 Sep 2026, 11.05',reason:'Gagal bayar QRIS',consentStatus:'GRANTED',contacted:false},
  {id:'lead-03',name:'Hendra Gunawan',company:'PT Nusantara Beton',plan:'Scale',phone:'+62 813-4455-6677',phoneClean:'6281344556677',abandonAt:'5 Sep 2026, 16.45',reason:'Batal di halaman Mayar',consentStatus:'SUPPRESSED',contacted:false}
];
export function money(value:number,compact=false){if(!Number.isFinite(value))return 'Belum tersedia';if(compact&&Math.abs(value)>=1e9)return 'Rp'+new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(value/1e9)+' M';if(compact&&Math.abs(value)>=1e6)return 'Rp'+new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(value/1e6)+' jt';return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);}
export function dateLabel(value:string){return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value+'T00:00:00Z'));}
export function stageMetrics(values:StageValues){const invalid=values.some((v,i)=>!Number.isFinite(v)||v<0||(i>0&&v>values[i-1]));const gaps=values.slice(0,5).map((v,i)=>v-values[i+1]);return {gaps,invalid,unbilled:values[0]-values[4],receivable:values[4]-values[5],total:values[0]-values[5],identityValid:!invalid&&gaps.reduce((a,b)=>a+b,0)===values[0]-values[5]};}
export function sumStages(projects:Project[]):StageValues{return projects.reduce((a,p)=>a.map((v,i)=>v+p.values[i]) as StageValues,[0,0,0,0,0,0] as StageValues);}
export function daysOverdue(due:string,asOf=AS_OF){return Math.max(0,Math.floor((Date.parse(asOf)-Date.parse(due))/86400000));}
export function invoiceStatus(i:Invoice){if(i.status!=='Terbit')return i.status;if(i.paid>=i.principal)return 'Lunas';if(daysOverdue(i.due)>0)return 'Lewat jatuh tempo';return i.paid>0?'Sebagian dibayar':'Belum dibayar';}
export function validateReceipt(amount:number,allocations:{outstanding:number;amount:number}[]){if(!Number.isFinite(amount)||amount<=0)return 'Masukkan nilai penerimaan lebih dari nol.';if(allocations.some(a=>!Number.isFinite(a.amount)||a.amount<0||a.amount>a.outstanding))return 'Alokasi tidak boleh melebihi sisa tagihan.';if(allocations.reduce((a,b)=>a+b.amount,0)>amount)return 'Total alokasi melebihi penerimaan.';if(!allocations.some(a=>a.amount>0))return 'Pilih sedikitnya satu alokasi.';return null;}
export function safeReturn(value:string|null){return value&&/^\/(dashboard|projects|actions|invoices|reports|billing|onboarding|checkout|support|settings)(\/|\?|$)/.test(value)&&!value.includes('\\')&&!value.includes('://')?value:'/dashboard';}
export function csvText(rows:(string|number)[][]){return '\uFEFF'+rows.map(row=>row.map(v=>{const s=String(v);return '"'+(/^[=+@\-\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export function download(name:string,content:string,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function validateAttachments(files:File[]){if(files.length>3)return 'Maksimal 3 file per kiriman.';if(files.some(f=>f.size>5*1024*1024))return 'Ukuran setiap file maksimal 5 MB.';if(files.some(f=>!['image/png','image/jpeg','application/pdf'].includes(f.type)))return 'Gunakan PNG, JPEG, atau PDF.';return null;}
