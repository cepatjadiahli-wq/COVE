"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Mail, Lock, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("PT Kontraktor Baru Nusantara");
  const [fullName, setFullName] = useState("Budi Santoso");
  const [email, setEmail] = useState("budi@kontraktorbaru.co.id");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

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
                placeholder="Nama Lengkap Direktur / Commercial"
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
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2 bg-slate-900 hover:bg-slate-800 font-bold h-10">
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
