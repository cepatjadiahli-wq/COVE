/**
 * COVE Indonesian Executive Legal Letter Engine
 * Generates official construction correspondence letters complying with Indonesian contracting standards.
 */

import { formatIDR } from "@/lib/utils";
import { terbilangIDR } from "@/lib/finance/construction-tax";

export type LegalLetterType =
  | "OPNAME_REQUEST"
  | "PAYMENT_INVOICE"
  | "PAYMENT_OVERDUE_WARNING"
  | "ADDENDUM_REQUEST";

export interface LegalLetterContext {
  letterType: LegalLetterType;
  letterNumber: string;
  letterDate: string; // YYYY-MM-DD
  attachmentCount: string;
  urgencyLevel: "Biasa" | "Penting" | "Sangat Segera";
  subject: string;

  // Sender (Kontraktor)
  companyName: string;
  companyLegalName: string;
  companyAddress: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  signatoryName: string;
  signatoryJobTitle: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;

  // Recipient (Owner / MK)
  recipientName: string;
  recipientTitle: string;
  recipientCompany: string;
  recipientAddress: string;
  recipientCity: string;

  // Project & Contract
  projectName: string;
  projectCode: string;
  contractNumber: string;
  contractDate: string;
  claimNumber: string;
  claimPeriod: string;

  // Financial Values (if applicable)
  grossClaimAmount: number;
  netPayableAmount: number;
  overdueDays?: number;
  variationAmount?: number;
  timeExtensionDays?: number;

  // Custom Notes
  customNotes?: string;
  carbonCopyList: string[]; // Tembusan
}

export function toRomanMonth(date: Date): string {
  const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romanMonths[date.getMonth()];
}

export function generateAutomatedLetterNumber(
  sequence: number,
  projectCode: string,
  letterType: LegalLetterType,
  date: Date = new Date()
): string {
  const seqStr = String(sequence).padStart(3, "0");
  const roman = toRomanMonth(date);
  const year = date.getFullYear();

  let code = "EXT";
  if (letterType === "PAYMENT_INVOICE") code = "INV-TRM";
  if (letterType === "PAYMENT_OVERDUE_WARNING") code = "SOMA-TRM";
  if (letterType === "OPNAME_REQUEST") code = "OPN-REQ";
  if (letterType === "ADDENDUM_REQUEST") code = "ADD-REQ";

  return `${seqStr}/${code}/NB-${projectCode}/${roman}/${year}`;
}

export interface GeneratedLetterContent {
  subject: string;
  openingParagraph: string;
  bodyParagraphs: string[];
  financialTable?: {
    label: string;
    value: string;
  }[];
  closingParagraph: string;
}

export function getLegalLetterContent(ctx: LegalLetterContext): GeneratedLetterContent {
  const contractRef = `Surat Perjanjian Pemborongan (Kontrak) No. ${ctx.contractNumber} tanggal ${ctx.contractDate} untuk pekerjaan Proyek ${ctx.projectName}`;

  switch (ctx.letterType) {
    case "OPNAME_REQUEST":
      return {
        subject: `Permohonan Pemeriksaan Bersama (Joint Opname) Progres Pekerjaan ${ctx.claimNumber}`,
        openingParagraph: `Sehubungan dengan pelaksanaan pekerjaan ${contractRef}, bersama surat ini kami sampaikan bahwa progres fisik pekerjaan di lapangan untuk periode ${ctx.claimPeriod} telah selesai dilaksanakan sesuai spesifikasi teknis yang dipersyaratkan.`,
        bodyParagraphs: [
          `Guna memenuhi tertib administrasi proyek dan penerbitan Berita Acara Pemeriksaan Pekerjaan, kami bermaksud mengajukan permohonan pelaksanaan Pemeriksaan Bersama (Joint Opname) antara Tim Quantity Surveyor Kontraktor, Tim Pengawas Konsultan Manajemen Konstruksi (MK), dan Direksi Teknis Pemberi Tugas.`,
          `Adapun pelaksanaan Joint Opname kami usulkan pada jadwal berikut:`,
          `• Hari / Tanggal : Sesuai konfirmasi kesiapan Tim Pengawas MK\n• Waktu : Pukul 09.00 WIB s/d selesai\n• Lokasi : Area Proyek ${ctx.projectName}\n• Agenda : Pengukuran volume pembesian, pengecoran, dan checklist arsitektur periode ${ctx.claimNumber}`,
          `Bersama surat ini kami lampirkan dokumen pendukung berupa Laporan Mingguan Progres, Lembar Perhitungan Volume (Back-up Quantity), dan Foto Dokumentasi Fisik Lapangan ber-geotag GPS.`,
        ],
        closingParagraph: `Demikian surat permohonan ini kami sampaikan. Atas perhatian, kesediaan waktu, dan kerja sama yang baik dari Bapak/Ibu, kami ucapkan terima kasih.`,
      };

    case "PAYMENT_INVOICE":
      return {
        subject: `Permohonan Pembayaran Termin Progress Claim ${ctx.claimNumber}`,
        openingParagraph: `Merujuk pada ${contractRef} serta Berita Acara Pembayaran (BAP) No. BAP/${new Date().getFullYear()}/${ctx.projectCode}/${ctx.claimNumber} yang telah ditandatangani bersama, dengan ini kami mengajukan permohonan pembayaran termin progress pekerjaan ${ctx.claimNumber} periode ${ctx.claimPeriod}.`,
        bodyParagraphs: [
          `Pekerjaan fisik dan administrasi telah diperiksa dan disetujui oleh Konsultan Pengawas Manajemen Konstruksi (MK) dengan rincian kewajiban pembayaran bersih sebagai berikut:`,
        ],
        financialTable: [
          { label: "Nilai Prestasi Pekerjaan (Gross)", value: formatIDR(ctx.grossClaimAmount) },
          { label: "Nilai Bersih Pembayaran (Net Payable)", value: formatIDR(ctx.netPayableAmount) },
          { label: "Terbilang", value: terbilangIDR(ctx.netPayableAmount) },
          { label: "Bank Penerima", value: ctx.bankName },
          { label: "Nomor Rekening", value: ctx.bankAccountNumber },
          { label: "Atas Nama Rekening", value: ctx.bankAccountHolder },
        ],
        closingParagraph: `Pembayaran mohon dapat ditransfer ke rekening resmi perusahaan kami di atas paling lambat sesuai dengan batas waktu jatuh tempo kontrak. Terlampir kami sertakan 1 (satu) berkas Kuitansi bermaterai, Faktur Pajak, BAP Asli, dan Laporan Rekapitulasi Progres. Atas kerja sama dan kelancaran pembayaran yang diberikan, kami ucapkan terima kasih.`,
      };

    case "PAYMENT_OVERDUE_WARNING":
      return {
        subject: `SURAT TEGURAN / PERINGATAN KETERLAMBATAN PEMBAYARAN TERMIN ${ctx.claimNumber}`,
        openingParagraph: `Menindaklanjuti Surat Penagihan Termin kami No. ${ctx.letterNumber.replace("SOMA", "INV")} tertanggal ${ctx.contractDate} serta Berita Acara Pembayaran (BAP) No. BAP/${new Date().getFullYear()}/${ctx.projectCode}/${ctx.claimNumber} terkait ${contractRef}, kami menyampaikan pemberitahuan resmi bahwa tagihan termin tersebut telah melewati tanggal jatuh tempo pembayaran (${ctx.overdueDays || 14} hari kerja).`,
        bodyParagraphs: [
          `Sesuai dengan ketentuan Pasal Pembayaran pada Surat Perjanjian Kontrak, pembayaran termin wajib direalisasikan selambat-lambatnya 14 (empat belas) hari kerja setelah dokumen penagihan dan BAP diterima secara lengkap oleh Pemberi Tugas.`,
          `Keterlambatan pencairan dana termin ini telah berdampak langsung pada likuiditas operasional proyek, khususnya pemenuhan upah tenaga kerja mandor lapangan serta kepastian pembayaran pasokan material utama proyek ${ctx.projectName}.`,
          `Sehubungan dengan hal tersebut di atas, kami memohon dengan hormat kepada Direksi Pemberi Tugas untuk segera merealisasikan pencairan pembayaran termin bersih senilai ${formatIDR(ctx.netPayableAmount)} (${terbilangIDR(ctx.netPayableAmount)}) dalam waktu selambat-lambatnya 3 x 24 Jam sejak surat ini diterima, guna menjaga kelancaran jadwal serah terima proyek di lapangan.`,
        ],
        financialTable: [
          { label: "Nomor Tagihan / BAP", value: `BAP/${ctx.projectCode}/${ctx.claimNumber}` },
          { label: "Nilai Tagihan Tertunggak", value: formatIDR(ctx.netPayableAmount) },
          { label: "Keterlambatan (Overdue)", value: `${ctx.overdueDays || 14} Hari Kalender` },
          { label: "Rekening Transfer", value: `${ctx.bankName} - ${ctx.bankAccountNumber} a.n. ${ctx.bankAccountHolder}` },
        ],
        closingParagraph: `Besar harapan kami agar permohonan pencairan ini dapat segera ditindaklanjuti demi kelangsungan pekerjaan dan hubungan kemitraan profesional yang baik antara kedua belah pihak. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.`,
      };

    case "ADDENDUM_REQUEST":
      return {
        subject: `Permohonan Amandemen Kontrak (Addendum Biaya & Waktu) Akibat Pekerjaan Tambah`,
        openingParagraph: `Sehubungan dengan pelaksanaan ${contractRef} serta diterbitkannya Instruksi Lapangan / Site Instruction oleh Konsultan Manajemen Konstruksi No. SI-042 terkait penyesuaian desain struktur di lapangan, dengan ini kami mengajukan permohonan resmi Amandemen / Addendum Kontrak.`,
        bodyParagraphs: [
          `Berdasarkan hasil pengukuran dan verifikasi teknis bersama di lapangan, pekerjaan tambah tersebut memerlukan penyesuaian nilai kontrak dan perpanjangan masa pelaksanaan (Time Extension) dengan rincian sebagai berikut:`,
        ],
        financialTable: [
          { label: "Usulan Penambahan Nilai Kontrak", value: formatIDR(ctx.variationAmount || 850000000) },
          { label: "Usulan Perpanjangan Waktu Pelaksanaan", value: `${ctx.timeExtensionDays || 14} Hari Kalender` },
          { label: "Rujukan Instruksi MK", value: "Site Instruction No. SI-042 & Notulen Rapat Lapangan" },
        ],
        closingParagraph: `Bersama surat ini kami lampirkan Rincian Anggaran Biaya (RAB Tambah Kurang), Analisa Harga Satuan Pekerjaan (AHSP), serta Jadwal Kurva S Penyesuaian. Kami memohon kiranya dapat dijadwalkan rapat pembahasan addendum bersama Direksi Pemberi Tugas dan Konsultan MK. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.`,
      };
  }
}
