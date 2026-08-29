"use client";

import React, { createContext, useContext, useState } from "react";
import { coveStore } from "@/domains/store/persistent-store";
import { DemoProfile, DemoOrg } from "@/domains/demo/seed-data";

interface TenantContextType {
  currentOrg: DemoOrg;
  currentUser: DemoProfile;
  allProfiles: DemoProfile[];
  setCurrentUserById: (userId: string) => void;
  refreshTrigger: number;
  refreshState: () => void;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentOrg] = useState<DemoOrg>(coveStore.organizations[0]);
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

  return (
    <TenantContext.Provider
      value={{
        currentOrg,
        currentUser,
        allProfiles: coveStore.profiles,
        setCurrentUserById,
        refreshTrigger,
        refreshState,
      }}
    >
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
