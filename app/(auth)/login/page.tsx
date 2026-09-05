"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ArrowRight, Lock, Mail, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

// Safe set of allowed internal redirect paths
const ALLOWED_RETURN_PATHS = ["/pricing", "/dashboard", "/billing", "/onboarding", "/settings"];

function isSafeReturnTo(path: string | null): boolean {
  if (!path) return false;
  try {
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) return false;
    return ALLOWED_RETURN_PATHS.some((allowed) => path.startsWith(allowed));
  } catch {
    return false;
  }
}

// Inner component reads search params — must be wrapped in Suspense
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTo = searchParams.get("returnTo");
  const plan = searchParams.get("plan");
  const reason = searchParams.get("reason");

  function buildPostLoginUrl(): string {
    if (isSafeReturnTo(returnTo)) {
      if (plan) return `${returnTo}?plan=${encodeURIComponent(plan)}`;
      return returnTo!;
    }
    return "/dashboard";
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("invalid login credentials")) {
          setError("Email atau password salah. Periksa kembali dan coba lagi.");
        } else if (signInError.message.toLowerCase().includes("email not confirmed")) {
          setError("Email belum dikonfirmasi. Periksa inbox email Anda.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      // Login successful — SSR cookie written by Supabase browser client.
      const redirectUrl = buildPostLoginUrl();
      router.replace(redirectUrl);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setLoading(false);
    }
  };

  return (
    <>
      {/* Session migration notice */}
      {reason === "session_migration" && (
        <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Sesi keamanan telah diperbarui. Silakan login kembali satu kali.</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
              placeholder="name@company.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-blue-700 hover:underline font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-slate-900 hover:bg-slate-800 font-bold h-10"
        >
          {loading ? "Signing in..." : "Sign In"}
          {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 border border-slate-200">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white font-extrabold text-2xl shadow-md mb-3">
            C
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in to COVE</h1>
          <p className="text-xs text-slate-500 mt-1">Construction Operations Value Engine</p>
        </div>

        {/* Suspense boundary required by Next.js for useSearchParams */}
        <Suspense fallback={<div className="h-4 mb-4" />}>
          <LoginForm />
        </Suspense>

        <div className="mt-6 text-center text-xs text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-700 font-semibold hover:underline">
            Create organization
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="h-3 w-3" />
          <span>Secured by Supabase Auth · COVE v19.5.0</span>
        </div>
      </div>
    </div>
  );
}
