# COVE — Payment Provider Decision & Architectural Strategy

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Reference Document:** `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` (Bagian 10, 20)  

---

## 1. Identifikasi Kondisi Payment Provider Saat Ini

Pada saat audit Phase 13 dilakukan:
* **Provider Terpasang:** **Mayar.id** (`lib/mayar/client.ts`, `app/api/payment/checkout/route.ts`, `app/api/webhooks/mayar/route.ts`).
* **Karakteristik Integrasi Eksisting:**
  - Integrasi menggunakan endpoint `https://api.mayar.id/hl/v1/payment/create`.
  - Beroperasi sebagai **One-Time Invoice Link** (pembayaran tunggal per transaksi), bukan auto-debit langganan berkala otomatis.
  - Sesuai Aturan Mutlak 12: *"Jangan berasumsi bahwa payment link satu kali sama dengan recurring payment."*
  - Verifikasi token webhook bersifat statis dan belum memiliki mekanisme verifikasi HMAC SHA-256 kriptografis yang dinamis.
  - Skema database saat ini (`mayar_transactions`) terikat erat (*hard-coupled*) pada format payload Mayar.

---

## 2. Matriks Komparasi Kandidat Payment Gateway Indonesia

Evaluasi komparatif mendalam dilakukan terhadap 4 penyedia layanan pembayaran terkemuka untuk kebutuhan B2B Construction SaaS di Indonesia:

| Kriteria Evaluasi | Xendit (xendit.co) | Mayar.id (mayar.id) | Midtrans (midtrans.com) | Stripe (stripe.com) |
| :--- | :--- | :--- | :--- | :--- |
| **1. True Recurring Engine** | **Sangat Baik:** API Recurring Payments v2 khusus untuk schedule, interval, & automated debit. | **Terbatas:** Fitur membership di UI ada, namun API developer headless untuk auto-debit kartu terbatas. | **Baik:** Mendukung subscription berkala via Core API & SNAP (Card/GoPay). | **Luar Biasa:** Gold standard dunia untuk recurring billing (Stripe Billing). |
| **2. Tokenisasi Pembayaran** | Mendukung tokenisasi Credit/Debit Card, BCA OneKlik, BRI Direct Debit, e-Wallets. | Tidak menyediakan tokenisasi kartu headless untuk merchant application. | Mendukung tokenisasi kartu kredit (Card Tokenizer) & e-Wallet account binding. | Mendukung tokenisasi penuh (PaymentMethods / SetupIntents). |
| **3. Hosted Checkout** | Xendit Invoice & Subscription Checkout responsif mobile/desktop. | Mayar Hosted Payment Page (sederhana & cepat terpasang). | Midtrans SNAP modal & redirect checkout. | Stripe Hosted Checkout UI. |
| **4. Kematangan Webhook** | Sangat lengkap: payload standar, `x-callback-token`, event siklus hidup langganan terperinci. | Ada event dasar (`payment.received`, `invoice.paid`), tetapi minim event dunning granular. | Lengkap: notifikasi status transaksi HTTP POST dengan signature SHA-512. | Sangat lengkap dengan penandatanganan HMAC SHA-256 (`stripe-signature`). |
| **5. Retry & Dunning Otomatis** | Dapat dikonfigurasi: auto-retry interval 24 jam, batas maksimal percobaan, alert gagal. | Mengirimkan reminder faktur via email/WA, namun retry debit kartu tidak otomatis. | Retry transaksi kartu terbatas; lebih menitikberatkan notifikasi manual. | Smart Retries bertenaga Machine Learning (Stripe Radar & Dunning). |
| **6. Pembatalan & Perubahan** | Endpoint API lengkap untuk jeda (*pause*), ubah paket (*proration*), dan *cancel at period end*. | Pengelolaan melalui dashboard internal Mayar; minim kontrol programatik via API. | Pembatalan subscription via Core API `POST /v1/subscriptions/{id}/cancel`. | API lengkap untuk seluruh variasi pembatalan dan penjadwalan fase langganan. |
| **7. Refund Management** | API Refund terprogram langsung ke rekening sumber pembayaran asal. | Refund dicatat manual melalui kontak support dashboard. | API Refund didukung untuk kartu kredit, QRIS, dan GoPay. | API Refund instan otomatis terhubung ke sistem perbankan global. |
| **8. Kualitas Sandbox & Uji Coba** | Sangat Matang: Dashboard sandbox terpisah, simulator kartu/VA/QRIS otomatis, mock webhook tester. | Tersedia environment testing, namun simulator pembayaran terbatas pada invoice statis. | Sangat Matang: Simulator lengkap untuk seluruh bank nasional (BCA, Mandiri, BNI, BRI). | Sangat Matang: Simulator kartu uji coba internasional terlengkap di dunia. |
| **9. Metode Pembayaran B2B Indonesia** | **Lengkap & Relevan B2B:** Bank Transfer (Semua VA Bank Besar), QRIS, Corporate Card, Direct Debit. | **Cukup:** QRIS, VA BCA/Mandiri/Permata, e-Wallet. | **Lengkap:** Seluruh VA Bank Nasional, QRIS, Credit Card, ShopeePay/GoPay. | **Sangat Kurang untuk Pasar Lokal:** Tidak mendukung VA Bank Indonesia atau QRIS lokal secara native. |
| **10. Waktu Settlement Dana** | T+1 s/d T+2 hari kerja ke rekening bank lokal perusahaan. | T+1 s/d T+3 hari kerja setelah verifikasi payout. | T+1 s/d T+2 hari kerja otomatis ke bank nasional. | T+7 hari kerja (memerlukan entitas legal luar negeri / cross-border fee). |
| **11. Kemudahan Rekonsiliasi** | Format laporan bank statement CSV/Excel standar akuntansi, filter correlation ID. | Laporan transaksi sederhana di dashboard web. | Laporan mutasi bank terperinci dengan ID pesanan unik merchant. | Rekonsiliasi otomatis kelas dunia (Stripe Sigma & Revenue Recognition). |
| **12. Struktur Biaya Transaksi** | Transparan B2B: VA Rp 4.000–4.500/trx, Kartu Kredit 2.9% + Rp 2.000, QRIS 0.7%. | Bersaing: Biaya flat per transaksi + platform fee (Rp 3.000–5.000 per transaksi). | Standar industri: VA Rp 4.000/trx, Kartu 2.9% + Rp 2.000, QRIS 0.7%. | Sangat mahal untuk IDR: 3.4% + foreign exchange spread 2% jika entitas luar. |
| **13. Dokumentasi Developer** | Dokumentasi interaktif, SDK TypeScript/Node.js resmi, panduan Postman lengkap. | Dokumentasi API dasar (kurang update untuk endpoint langganan/membership). | Dokumentasi teknis sangat luas dan teruji puluhan tahun di ekosistem Indonesia. | Dokumentasi terbaik di industri perangkat lunak global. |
| **14. Syarat Aktivasi Akun** | Dokumen PT/CV (NIB, NPWP Perusahaan, Akta Pendirian, Rekening Giro Perusahaan). | Bisa perorangan dan badan usaha (proses verifikasi relatif cepat). | Dokumen legalitas badan usaha lengkap (NIB, NPWP, Rekening Koran). | Wajib memiliki entitas bisnis di negara yang didukung (SG/US/HK). |

---

## 3. Keputusan & Rekomendasi Arsitektural Provider

Berdasarkan analisis di atas, diputuskan strategi implementasi bertahap sebagai berikut:

### 3.1 Primary Provider: Xendit (Recurring Payments API v2)
* **Status Keputusan:** **DIREKOMENDASIKAN SEBAGAI PRIMARY PAYMENT GATEWAY COVE B2B.**
* **Alasan Utama:**
  1. Memiliki API Recurring Payments v2 resmi yang dirancang khusus untuk SaaS berlangganan di Indonesia.
  2. Mendukung tokenisasi kartu korporat dan Direct Debit bank nasional (BCA OneKlik, Mandiri) untuk mewujudkan pengalaman penagihan auto-renewal tanpa campur tangan manual (*Netflix-like experience*).
  3. Mendukung seluruh metode pembayaran yang disukai bendahara/keuangan kontraktor konstruksi (BCA/Mandiri/BNI/BRI Virtual Account dan QRIS).
  4. Webhook security menggunakan cryptographic verification yang dapat diandalkan untuk menjamin status pembayaran real-time.
  5. Fitur Sandbox Xendit memungkinkan pengujian 26 skenario UAT Subscription pada Phase 19 tanpa menggunakan uang riil.

### 3.2 Legacy & Fallback Adapter: Mayar.id
* **Status Keputusan:** **DIPERTAHANKAN SEBAGAI ALTERNATIF INVOICE / PILOT CHECKOUT ADAPTER.**
* **Alasan:**
  1. Akun dan kode integrasi awal Mayar telah ada di basis kode eksisting.
  2. Cocok digunakan sebagai alternatif penerbitan tautan faktur tunggal (*single invoice link*) untuk paket **Paid Concierge Pilot 45 Hari (Rp 10.000.000)** yang hanya ditagihkan satu kali (*one-off engagement*) di awal.
  3. Dibungkus secara ketat di balik `PaymentProviderAdapter` sehingga kelemahan fungsional Mayar tidak merembes ke domain logika inti COVE.

### 3.3 Diskualifikasi Midtrans & Stripe
* **Stripe:** Didiskualifikasi karena ketiadaan metode pembayaran Virtual Account bank nasional Indonesia (BCA, Mandiri, BNI) dan QRIS lokal yang merupakan metode transaksi mutlak bagi kontraktor MEP Indonesia.
* **Midtrans:** Tidak dipilih sebagai primary karena API Recurring-nya lebih terfragmentasi dan kurang ergonomis dibandingkan API Recurring Payments v2 milik Xendit.

---

## 4. Desain Generic Provider Adapter Interface (Phase 15 Blueprint)

Sesuai Prinsip Non-Negotiable Bagian 3.9, kode domain COVE tidak boleh memanggil SDK gateway secara langsung, melainkan harus melalui antarmuka generik berikut:

```typescript
// Blueprint Antarmuka Generic Payment Provider (Akan diimplementasikan pada Phase 15)
export interface PaymentProviderAdapter {
  readonly providerName: "XENDIT" | "MAYAR" | "MOCK";

  // Manajemen Data Pelanggan di Gateway
  createCustomer(org: { id: string; name: string; email: string; phone?: string }): Promise<{ providerCustomerId: string }>;

  // Sesi Checkout Berlangganan
  createCheckoutSession(params: {
    orgId: string;
    planId: string;
    priceId: string;
    amount: number;
    interval: "MONTHLY" | "ANNUAL" | "ONEOFF";
    successUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  }): Promise<{ checkoutUrl: string; sessionId: string }>;

  // Siklus Langganan
  createSubscription(params: {
    providerCustomerId: string;
    planCode: string;
    amount: number;
    interval: "MONTHLY" | "ANNUAL";
  }): Promise<{ providerSubscriptionId: string; status: string }>;

  getSubscription(providerSubscriptionId: string): Promise<any>;
  cancelSubscription(providerSubscriptionId: string, cancelAtPeriodEnd: boolean): Promise<boolean>;

  // Validasi & Normalisasi Webhook
  verifyWebhook(headers: Record<string, string | null>, rawBody: string): boolean;
  normalizeWebhookEvent(rawPayload: any): NormalizedWebhookEvent;

  // Rekonsiliasi & Refund
  refundPayment(paymentId: string, amount: number, reason: string): Promise<{ refundId: string; status: string }>;
  reconcileTransaction(externalTransactionId: string): Promise<{ status: string; amount: number; settledAt?: string }>;
}

export interface NormalizedWebhookEvent {
  eventId: string;
  eventType: 
    | "CHECKOUT_COMPLETED"
    | "SUBSCRIPTION_ACTIVATED"
    | "BILLING_CYCLE_CREATED"
    | "PAYMENT_SUCCEEDED"
    | "PAYMENT_FAILED"
    | "SUBSCRIPTION_CHANGED"
    | "CANCELLATION_SCHEDULED"
    | "SUBSCRIPTION_CANCELLED"
    | "SUBSCRIPTION_EXPIRED"
    | "REFUND_COMPLETED";
  provider: "XENDIT" | "MAYAR" | "MOCK";
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  externalPaymentId?: string;
  amount: number;
  currency: string;
  paidAt?: string;
  metadata?: Record<string, any>;
}
```

> **Catatan Tata Kelola Phase 13:** Tidak ada perubahan kode atau instalasi dependensi SDK payment gateway yang dilakukan pada Phase 13. Seluruh implementasi adapter dan pemanggilan API gateway baru akan dilakukan pada **Phase 15 (Checkout dan Webhook)** setelah fondasi data model pada Phase 14 tervalidasi 100%.
