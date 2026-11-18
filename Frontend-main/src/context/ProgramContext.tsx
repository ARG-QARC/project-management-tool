"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/api";

export type Program = {
  id: string;
  name: string;
  code?: string;
  description: string;
  domain: string;
  status: "Active" | "Paused" | "Completed";
  projectIds?: string[];
};

export const DEFAULT_PROGRAMS: Program[] = [
  {
    id: "prog-qarc",
    name: "QUANTUM AGENTIC RESEARCH CENTER",
    code: "QARC",
    description: "Advanced AI agent research, multimodal pipelines, edge intelligence, and autonomous enterprise systems.",
    domain: "Agentic AI & Edge Intelligence",
    status: "Active",
  },
  {
    id: "prog-core-fintech",
    name: "Fintech & Banking Ecosystem",
    code: "FIN",
    description: "Core banking platform, payment gateways, and regulatory ledger services.",
    domain: "Financial Services",
    status: "Active",
  },
  {
    id: "prog-ai-intelligence",
    name: "AI & Platform Intelligence",
    code: "AI",
    description: "Enterprise machine learning models, analytics copilot, and data pipelines.",
    domain: "Artificial Intelligence",
    status: "Active",
  },
  {
    id: "prog-customer-cx",
    name: "Customer Experience & Mobile",
    code: "CX",
    description: "Next-generation iOS & Android apps, onboarding flows, and customer journey.",
    domain: "Mobile & Product",
    status: "Active",
  },
  {
    id: "prog-cloud-infra",
    name: "Cloud & DevSecOps Infrastructure",
    code: "OPS",
    description: "Zero-trust network, high-throughput microservices, and multi-region failover.",
    domain: "Infrastructure",
    status: "Active",
  }
];

type ProgramContextType = {
  programs: Program[];
  selectedProgram: Program | null; // null = "All Programs / Global View" (manager only)
  selectProgram: (programId: string | "all") => void;
  addProgram: (program: Omit<Program, "id">) => void;
  refreshPrograms: () => Promise<void>;
  getProjectProgram: (project: { id?: string; name?: string; domain?: string; program_id?: string; programId?: string; program_name?: string }) => Program;
  isManager: boolean;
};

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");

  const checkIsManager = (userObj: any) => {
    const role = (userObj?.role || "").toLowerCase();
    return (
      role.includes("manager") ||
      role.includes("administrator") ||
      role.includes("admin") ||
      role.includes("lead")
    );
  };

  const isManager = checkIsManager(currentUser);

  // Sync user and fetch programs
  const syncUserAndPrograms = useCallback(async () => {
    let userObj: any = null;
    try {
      const stored = localStorage.getItem("user");
      if (stored && stored !== "undefined") {
        userObj = JSON.parse(stored);
        setCurrentUser(userObj);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error(e);
    }

    const userIsMgr = checkIsManager(userObj);
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");

    if (!token) {
      setPrograms([]);
      setSelectedProgramId("all");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/programs`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.programs)) {
          const apiPrograms: Program[] = data.programs.map((p: any) => ({
            id: p.id,
            name: p.name,
            code: p.code || p.name.substring(0, 4).toUpperCase(),
            description: p.description || "",
            domain: p.domain || "",
            status: (p.status === "Active" || p.status === "Paused" || p.status === "Completed") ? p.status : "Active",
          }));

          setPrograms(apiPrograms);

          if (!userIsMgr) {
            if (apiPrograms.length > 0) {
              setSelectedProgramId(apiPrograms[0].id);
              localStorage.setItem("arg_selected_program", apiPrograms[0].id);
            } else {
              setSelectedProgramId("all");
            }
          } else {
            const storedSelected = localStorage.getItem("arg_selected_program");
            if (storedSelected && (storedSelected === "all" || apiPrograms.some(p => p.id === storedSelected))) {
              setSelectedProgramId(storedSelected);
            } else {
              setSelectedProgramId("all");
            }
          }
          return;
        }
      }
    } catch (err) {
      console.warn("Could not fetch programs from API, using fallback:", err);
    }

    // Fallback logic only on network error
    const storedSelected = localStorage.getItem("arg_selected_program") || "all";
    setSelectedProgramId(storedSelected);
  }, []);

  useEffect(() => {
    syncUserAndPrograms();
    window.addEventListener("storage", syncUserAndPrograms);
    window.addEventListener("programsUpdated", syncUserAndPrograms);
    return () => {
      window.removeEventListener("storage", syncUserAndPrograms);
      window.removeEventListener("programsUpdated", syncUserAndPrograms);
    };
  }, [syncUserAndPrograms]);

  const selectProgram = (programId: string | "all") => {
    // Member cannot select "all" or other programs if assigned one
    if (!isManager && programs.length > 0) {
      const memberProg = programs[0].id;
      setSelectedProgramId(memberProg);
      localStorage.setItem("arg_selected_program", memberProg);
      return;
    }

    setSelectedProgramId(programId);
    try {
      localStorage.setItem("arg_selected_program", programId);
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error(e);
    }
  };

  const addProgram = (newP: Omit<Program, "id">) => {
    const created: Program = {
      ...newP,
      id: `prog-${Date.now()}`,
      code: (newP.code || newP.name.substring(0, 3)).toUpperCase(),
    };
    const updated = [...programs, created];
    setPrograms(updated);
    try {
      localStorage.setItem("arg_programs", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Active program: for a member, if selectedProgramId isn't found, default to their only program
  const activeProgram =
    selectedProgramId === "all"
      ? null
      : programs.find(p => p.id === selectedProgramId) || (!isManager && programs.length > 0 ? programs[0] : null);

  // Helper to map a project to its program
  const getProjectProgram = (project: { id?: string; name?: string; domain?: string; program_id?: string; programId?: string; program_name?: string }): Program => {
    const defaultProg = programs[0] || DEFAULT_PROGRAMS[0];

    // Priority 1: Direct database program association (NEVER override an explicit program_id)
    const directProgramId = project.program_id || project.programId;
    if (directProgramId) {
      const matched = programs.find(p => p.id === directProgramId);
      if (matched) return matched;
      if (activeProgram && activeProgram.id === directProgramId) return activeProgram;
      return {
        id: directProgramId,
        name: project.program_name || "Assigned Program",
        code: (project.program_name || "PRG").substring(0, 4).toUpperCase(),
        description: "",
        domain: project.domain || "",
        status: "Active",
      };
    }

    const nameLower = (project.name || "").toLowerCase();
    const domainLower = (project.domain || "").toLowerCase();

    // Priority 2: Match against user's actual programs by name or domain
    if (programs.length > 0) {
      const matchedByNameOrDomain = programs.find(p => {
        const pName = (p.name || "").toLowerCase();
        const pDomain = (p.domain || "").toLowerCase();
        return (
          (pName && (nameLower.includes(pName) || pName.includes(nameLower) || (domainLower && pName.includes(domainLower)))) ||
          (pDomain && domainLower && (domainLower.includes(pDomain) || pDomain.includes(domainLower)))
        );
      });
      if (matchedByNameOrDomain) return matchedByNameOrDomain;
    }

    return defaultProg;
  };

  return (
    <ProgramContext.Provider
      value={{
        programs,
        selectedProgram: activeProgram,
        selectProgram,
        addProgram,
        refreshPrograms: syncUserAndPrograms,
        getProjectProgram,
        isManager,
      }}
    >
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error("useProgram must be used within a ProgramProvider");
  }
  return context;
}
