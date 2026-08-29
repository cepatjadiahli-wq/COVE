"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 border border-slate-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white font-extrabold text-2xl shadow-md mb-3">
            C
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reset Password</h1>
          <p className="text-xs text-slate-500 mt-1">Enter your work email to receive password reset instructions</p>
        </div>

        {submitted ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
            <h4 className="text-sm font-bold text-emerald-900">Email Sent</h4>
            <p className="text-xs text-emerald-700 mt-1">
              If an account exists for {email}, you will receive a secure password reset link.
            </p>
            <Link href="/login" className="mt-4 inline-block text-xs font-semibold text-emerald-900 underline">
              Return to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Work Email Address</Label>
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

            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 font-bold h-10">
              Send Reset Link
            </Button>

            <div className="text-center mt-4">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
