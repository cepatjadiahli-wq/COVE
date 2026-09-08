// ============================================================================
// COVE Backend — Progress-to-Cash Ledger Service v2.1
// Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §5, §7
// ============================================================================

import type {StageValues, StageMetricsResult, ProjectEntity} from '../types/domain.js';
import {db} from '../db/store.js';

export class LedgerService {
  /**
   * Menghitung gap G1–G5 dan memvalidasi invarian identitas komersial:
   * G1 + G2 + G3 + G4 + G5 = Work Performed - Collected
   */
  public static calculateMetrics(values: StageValues): StageMetricsResult {
    // Deteksi anomali (nilai tahap tidak boleh melebihi nilai upstream)
    const invalid = values.some((v, i) => !Number.isFinite(v) || v < 0 || (i > 0 && v > values[i - 1]));

    const gaps: [number, number, number, number, number] = [
      values[0] - values[1], // G1: Belum diukur
      values[1] - values[2], // G2: Belum diajukan
      values[2] - values[3], // G3: Belum disetujui
      values[3] - values[4], // G4: Belum ditagihkan
      values[4] - values[5]  // G5: Belum diterima (Piutang / AR)
    ];

    const unbilled = values[0] - values[4];
    const receivable = values[4] - values[5];
    const total = values[0] - values[5];
    const sumGaps = gaps.reduce((acc, g) => acc + g, 0);
    const identityValid = !invalid && sumGaps === total;

    return {
      gaps,
      unbilled,
      receivable,
      total,
      identityValid,
      invalid
    };
  }

  /**
   * Menjumlahkan nilai stage dari sekumpulan proyek (portofolio)
   */
  public static aggregateStages(projects: ProjectEntity[]): StageValues {
    return projects.reduce(
      (acc, p) => acc.map((v, i) => v + p.values[i]) as StageValues,
      [0, 0, 0, 0, 0, 0] as StageValues
    );
  }

  /**
   * Mencatat mutasi draf progres/pengukuran/klaim baru
   */
  public static recordStageEntry(
    projectId: string,
    stageIndex: number,
    amount: number,
    reference: string,
    reason: string
  ): {success: boolean; project?: ProjectEntity; error?: string} {
    const project = db.projects.find(p => p.id === projectId);
    if (!project) return {success: false, error: 'Proyek tidak ditemukan.'};
    if (stageIndex < 0 || stageIndex > 5) return {success: false, error: 'Indeks tahapan tidak valid.'};
    if (amount <= 0) return {success: false, error: 'Nilai harus lebih dari nol.'};

    // Nilai tahap tidak boleh melebihi tahap sebelumnya
    if (stageIndex > 0 && amount > project.values[stageIndex - 1]) {
      return {success: false, error: 'Nilai tahap tidak boleh melebihi nilai tahap sebelumnya.'};
    }

    project.values[stageIndex] = amount;
    project.updated = '8 Sep 2026, 09.45';

    db.save();

    return {success: true, project};
  }
}
