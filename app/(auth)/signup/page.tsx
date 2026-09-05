"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Mail, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Password harus minimal 8 karakter.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            org_name: orgName.trim(),
          },
          // Auth callback handles session cookie after email confirmation
          emailRedirectTo: `${window.location.origin}/api/auth/callback?returnTo=/onboarding`,
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already registered") ||
            signUpError.message.toLowerCase().includes("user already exists")) {
          setError("Email sudah terdaftar. Silakan login dengan akun yang ada.");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      // If email confirmation is disabled, session is immediately available
      if (data.session) {
        router.replace("/onboarding");
        return;
      }

      // Email confirmation required
      setEmailSent(true);
      setLoading(false);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 border border-slate-200 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-extrabold text-slate-900 mb-2">Periksa Email Anda</h1>
          <p className="text-sm text-slate-600">
            Kami mengirimkan tautan konfirmasi ke <strong>{email}</strong>. Klik tautan tersebut untuk mengaktifkan akun dan melanjutkan onboarding.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-blue-700 font-semibold hover:underline"
          >
            Kembali ke halaman login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 border border-slate-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white font-extrabold text-2xl shadow-md mb-3">
            C
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create Organization</h1>
          <p className="text-xs text-slate-500 mt-1">Start tracking project progress-to-cash in COVE</p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <Label htmlFor="orgName">Organization / Company Name</Label>
            <div className="relative mt-1.5">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="orgName"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="pl-9"
                placeholder="PT Nama Kontraktor"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative mt-1.5">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-9"
                placeholder="Nama Lengkap"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Work Email</Label>
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
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-slate-900 hover:bg-slate-800 font-bold h-10"
          >
            {loading ? "Creating Organization..." : "Create Organization & Start"}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-700 font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
