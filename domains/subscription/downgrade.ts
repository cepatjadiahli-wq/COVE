/**
 * COVE Phase 16: Downgrade Handling & Project Selection Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 8.2, 12)
 */

export interface ProjectSummary {
  id: string;
  name: string;
  code?: string;
  contractValue?: number;
  status?: string;
}

export interface EvaluateDowngradeImpactParams {
  activeProjects: ProjectSummary[];
  targetMaxProjects: number;
}

export interface DowngradeImpactResult {
  needsProjectSelection: boolean;
  currentActiveCount: number;
  targetMaxProjects: number;
  excessCount: number;
  activeProjects: ProjectSummary[];
  message: string;
}

export interface ValidateProjectSelectionParams {
  activeProjects: ProjectSummary[];
  targetMaxProjects: number;
  selectedProjectIds: string[];
}

export interface ProjectSelectionValidationResult {
  isValid: boolean;
  projectsToKeepActive: string[];
  projectsToArchive: string[];
  error?: string;
}

/**
 * Evaluates the impact of downgrading to a lower tier.
 */
export function evaluateDowngradeImpact(params: EvaluateDowngradeImpactParams): DowngradeImpactResult {
  const currentActiveCount = params.activeProjects.length;
  const targetMax = params.targetMaxProjects;
  const needsSelection = currentActiveCount > targetMax;
  const excessCount = Math.max(0, currentActiveCount - targetMax);

  return {
    needsProjectSelection: needsSelection,
    currentActiveCount,
    targetMaxProjects: targetMax,
    excessCount,
    activeProjects: params.activeProjects,
    message: needsSelection
      ? `Paket baru hanya mengizinkan ${targetMax} proyek aktif. Anda memiliki ${currentActiveCount} proyek aktif (${excessCount} proyek harus diarsipkan).`
      : `Paket baru mengizinkan hingga ${targetMax} proyek aktif. Seluruh ${currentActiveCount} proyek Anda tetap aktif.`,
  };
}

/**
 * Validates the user's project selection for a downgrade.
 */
export function validateDowngradeProjectSelection(params: ValidateProjectSelectionParams): ProjectSelectionValidationResult {
  const { activeProjects, targetMaxProjects, selectedProjectIds } = params;

  if (selectedProjectIds.length > targetMaxProjects) {
    return {
      isValid: false,
      projectsToKeepActive: [],
      projectsToArchive: [],
      error: `Pilihan proyek (${selectedProjectIds.length}) melebihi kuota paket tujuan (${targetMaxProjects} proyek).`,
    };
  }

  // Ensure all selected IDs exist in active projects
  const activeIdsSet = new Set(activeProjects.map((p) => p.id));
  for (const id of selectedProjectIds) {
    if (!activeIdsSet.has(id)) {
      return {
        isValid: false,
        projectsToKeepActive: [],
        projectsToArchive: [],
        error: `Proyek ID "${id}" tidak ditemukan dalam daftar proyek aktif saat ini.`,
      };
    }
  }

  const selectedSet = new Set(selectedProjectIds);
  const projectsToKeepActive = activeProjects.filter((p) => selectedSet.has(p.id)).map((p) => p.id);
  const projectsToArchive = activeProjects.filter((p) => !selectedSet.has(p.id)).map((p) => p.id);

  return {
    isValid: true,
    projectsToKeepActive,
    projectsToArchive,
  };
}
