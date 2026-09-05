"use client";

import React, { createContext, useContext, useState } from "react";
import { coveStore } from "@/domains/store/persistent-store";
import { DemoProfile, DemoOrg, INITIAL_ORG } from "@/domains/demo/seed-data";

import { evaluateRolePermission, hasProjectAccess, PermissionAction, PermissionEvaluation } from "@/lib/auth/rbac";

interface TenantContextType {
  currentOrg: DemoOrg;
  currentUser: DemoProfile;
  allProfiles: DemoProfile[];
  setCurrentUserById: (userId: string) => void;
  refreshTrigger: number;
  refreshState: () => void;
  hasPermission: (action: PermissionAction) => PermissionEvaluation;
  canAccessProject: (projectId: string) => boolean;
  isUserDeactivated: boolean;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentOrg] = useState<DemoOrg>(INITIAL_ORG);
  const [currentUser, setCurrentUser] = useState<DemoProfile>(coveStore.profiles[0]); // Default to Raka Pratama (Owner)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshState = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const setCurrentUserById = (userId: string) => {
    const found = coveStore.profiles.find((p) => p.id === userId);
    if (found) {
      setCurrentUser(found);
    }
  };

  const hasPermission = (action: PermissionAction): PermissionEvaluation => {
    if (currentUser.status === "DEACTIVATED") {
      return { allowed: false, scope: "NONE", reason: "Akun Anda telah dinonaktifkan oleh Administrator." };
    }
    return evaluateRolePermission(currentUser.role, action);
  };

  const canAccessProject = (projectId: string): boolean => {
    if (currentUser.status === "DEACTIVATED") return false;
    return hasProjectAccess({ role: currentUser.role, assignedProjectIds: currentUser.assignedProjectIds }, projectId);
  };

  const isUserDeactivated = currentUser.status === "DEACTIVATED";

  return (
    <TenantContext.Provider
      value={{
        currentOrg,
        currentUser,
        allProfiles: coveStore.profiles,
        setCurrentUserById,
        refreshTrigger,
        refreshState,
        hasPermission,
        canAccessProject,
        isUserDeactivated,
      }}
    >
      {isUserDeactivated && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md z-50 sticky top-0">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>PERINGATAN KEAMANAN: Akun pengguna <strong>{currentUser.fullName}</strong> saat ini berstatus <strong>DINONAKTIFKAN</strong>. Sesi aktif dicabut dan seluruh operasi mutasi ditolak (UAT-18).</span>
          </div>
          <button
            onClick={() => setCurrentUserById("usr-raka")}
            className="bg-white text-rose-800 text-[11px] px-2.5 py-1 rounded font-black hover:bg-rose-50"
          >
            Beralih ke Akun Owner (Raka Pratama)
          </button>
        </div>
      )}
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
