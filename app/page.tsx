import Link from "next/link";
import { ArrowRight, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="flex h-20 items-center justify-between px-8 border-b border-slate-800 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-extrabold text-xl shadow-lg">
            C
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-2xl tracking-tight text-white">COVE</span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
              Construction Operations Value Engine
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
              Sign In
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2">
              <span>Open Command Center</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 mb-8">
          <ShieldCheck className="h-4 w-4" />
          <span>Construction Economic Control System • V1.0 Build-Ready</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl text-white mb-6">
          Kendalikan Perjalanan Nilai Proyek dari <span className="text-blue-400">Progress</span> Menjadi{" "}
          <span className="text-emerald-400">Cash</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mb-10 leading-relaxed font-normal">
          COVE membantu kontraktor mendeteksi di mana nilai pekerjaan tertahan, mengukur exposure Rupiah,
          mengidentifikasi blocker operasional, dan mengeksekusi tindakan nyata hingga kas cair.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link href="/dashboard">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 px-8 text-base shadow-xl flex items-center gap-2">
              <span>Masuk Demo Command Center</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/progress-to-cash">
            <Button size="lg" variant="outline" className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold h-12 px-6 text-base">
              Lihat Progress-to-Cash Portfolio
            </Button>
          </Link>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full text-left">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/40">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 mb-4 font-bold">
              1
            </div>
            <h3 className="text-base font-bold text-white mb-2">Money Pipeline</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pantau konversi nilai: Work Performed → Measured → Claimed → Certified → Invoiced → Collected.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/40">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 mb-4 font-bold">
              2
            </div>
            <h3 className="text-base font-bold text-white mb-2">Cash-at-Risk Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deteksi dini keterlambatan SLA, blocker aktif, dan tagihan overdue tanpa double-counting.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/40">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-400 mb-4 font-bold">
              3
            </div>
            <h3 className="text-base font-bold text-white mb-2">Action & Outcome</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tugaskan penanggung jawab pada setiap risiko finansial dan ukur hasil pelepasan kas (cash released).
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-800/40">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 mb-4 font-bold">
              4
            </div>
            <h3 className="text-base font-bold text-white mb-2">Tenant Isolation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Keamanan multi-tenant level enterprise dengan PostgreSQL Row Level Security (RLS).
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-slate-800 flex items-center justify-between px-8 text-xs text-slate-500 max-w-7xl w-full mx-auto">
        <span>© 2026 PT Nusantara Buildindo • COVE Platform</span>
        <span>Default Currency: IDR • Timezone: Asia/Jakarta (WIB)</span>
      </footer>
    </div>
  );
}
