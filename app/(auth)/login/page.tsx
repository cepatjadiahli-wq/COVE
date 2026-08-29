"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/components/layout/TenantProvider";

export default function LoginPage() {
  const router = useRouter();
  const { allProfiles, setCurrentUserById } = useTenant();
  const [email, setEmail] = useState("raka@nusantarabuildindo.co.id");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Find matching profile or default to first
    const profile = allProfiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) || allProfiles[0];
    setCurrentUserById(profile.id);
    setTimeout(() => {
      router.push("/dashboard");
    }, 400);
  };

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
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2 bg-slate-900 hover:bg-slate-800 font-bold h-10">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {/* Quick Demo Access Bar */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-2 text-center">
            Quick Persona Switch
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {allProfiles.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setEmail(p.email);
                  setCurrentUserById(p.id);
                  router.push("/dashboard");
                }}
                className="p-2 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 text-left transition-colors"
              >
                <div className="font-semibold text-slate-900 truncate">{p.fullName}</div>
                <div className="text-[10px] text-slate-500 truncate">{p.jobTitle}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          Don't have an account?{" "}
          <Link href="/signup" className="text-blue-700 font-semibold hover:underline">
            Create organization
          </Link>
        </div>
      </div>
    </div>
  );
}
