// ============================================================================
// COVE Backend — Progress-to-Cash Ledger Service v2.2
// Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §5, §7, COVE_PRD_v2.0 §7
// Bridges domain models with canonical PostgreSQL ledger repository.
// ============================================================================

import type {StageValues, StageMetricsResult, ProjectEntity} from '../types/domain.js';
import {db} from '../db/store.js';
import {getLedgerRepository} from '../repositories/ledger.repository.js';
import {getProjectRepository} from '../repositories/project.repository.js';
import {
  type MoneyInput,
  parseMoney,
  addMoney,
  subtractMoney,
  compareMoney,
  isPositiveMoney
} from '../utils/money.js';

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
   * Mencatat mutasi draf progres/pengukuran/klaim baru secara canonical PostgreSQL.
   * Mendukung pemanggilan (orgId, projectId, stageIndex, amount, reference, reason)
   * dan backwards compatibility (projectId, stageIndex, amount, reference, reason).
   */
  public static async recordStageEntry(
    arg1: string,
    arg2: any,
    arg3?: any,
    arg4?: any,
    arg5?: any,
    arg6?: any
  ): Promise<{success: boolean; project?: any; error?: string}> {
    let orgId = '';
    let projectId = '';
    let stageIndex = 0;
    let rawAmount: MoneyInput = 0;
    let reference = 'REF-AUTO';
    let reason = 'Pencatatan ledger baru';

    if (arg6 !== undefined) {
      orgId = arg1;
      projectId = arg2;
      stageIndex = Number(arg3);
      rawAmount = arg4;
      reference = arg5 || 'REF-AUTO';
      reason = arg6 || 'Pencatatan ledger baru';
    } else {
      projectId = arg1;
      stageIndex = Number(arg2);
      rawAmount = arg3;
      reference = arg4 || 'REF-AUTO';
      reason = arg5 || 'Pencatatan ledger baru';
    }

    if (isNaN(stageIndex) || stageIndex < 0 || stageIndex > 5) return {success: false, error: 'Indeks tahapan tidak valid.'};

    let amount: string;
    try {
      amount = parseMoney(rawAmount);
      if (!isPositiveMoney(amount)) {
        return {success: false, error: 'Nilai harus lebih dari nol.'};
      }
    } catch (err: any) {
      return {success: false, error: err.message || 'Nilai tidak valid.'};
    }

    // If orgId is available, execute through canonical PostgreSQL ledger repository
    if (orgId) {
      const project = await getProjectRepository().getProjectById(orgId, projectId);
      if (!project) return {success: false, error: 'Proyek tidak ditemukan.'};
      if (project.status === 'Diarsipkan') {
        return {success: false, error: 'Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.'};
      }

      const ledgerRepo = getLedgerRepository();

      try {
        if (stageIndex === 0) {
          // Stage 0: Work Progress
          await ledgerRepo.createWorkProgressLine({
            orgId,
            projectId,
            description: reason || reference,
            principalAmount: amount,
            evidenceStatus: 'VERIFIED'
          });
        } else if (stageIndex === 1) {
          // Stage 1: Measurement
          const lines = await ledgerRepo.getWorkProgressLines(orgId, projectId);
          const availableLines = lines.filter(l => compareMoney(l.availableAmount, '0.00') > 0);
          let totalAvailable = '0.00';
          for (const l of availableLines) {
            totalAvailable = addMoney(totalAvailable, l.availableAmount);
          }

          if (compareMoney(amount, totalAvailable) > 0) {
            return {
              success: false,
              error: `Nilai pengukuran (${amount}) melebihi sisa progres yang belum diukur (${totalAvailable}).`
            };
          }

          let remainingToAllocate = amount;
          const allocations: {workProgressLineId: string; amount: string}[] = [];
          for (const line of availableLines) {
            if (compareMoney(remainingToAllocate, '0.00') <= 0) break;
            const allocAmount = compareMoney(remainingToAllocate, line.availableAmount) < 0 ? remainingToAllocate : line.availableAmount;
            allocations.push({workProgressLineId: line.id, amount: allocAmount});
            remainingToAllocate = subtractMoney(remainingToAllocate, allocAmount);
          }

          await ledgerRepo.createMeasurement({
            orgId,
            projectId,
            measurementNumber: reference,
            description: reason,
            allocations
          });
        } else if (stageIndex === 2) {
          // Stage 2: Claim
          const measurements = await ledgerRepo.getMeasurements(orgId, projectId);
          const availableMeas = measurements.filter(m => compareMoney(m.availableAmount, '0.00') > 0);
          let totalAvailable = '0.00';
          for (const m of availableMeas) {
            totalAvailable = addMoney(totalAvailable, m.availableAmount);
          }

          if (compareMoney(amount, totalAvailable) > 0) {
            return {
              success: false,
              error: `Nilai klaim (${amount}) melebihi sisa pengukuran yang belum diajukan (${totalAvailable}).`
            };
          }

          let remainingToAllocate = amount;
          const allocations: {measurementId: string; amount: string}[] = [];
          for (const meas of availableMeas) {
            if (compareMoney(remainingToAllocate, '0.00') <= 0) break;
            const allocAmount = compareMoney(remainingToAllocate, meas.availableAmount) < 0 ? remainingToAllocate : meas.availableAmount;
            allocations.push({measurementId: meas.id, amount: allocAmount});
            remainingToAllocate = subtractMoney(remainingToAllocate, allocAmount);
          }

          await ledgerRepo.createClaim({
            orgId,
            projectId,
            claimNumber: reference,
            description: reason,
            allocations
          });
        } else if (stageIndex === 3) {
          // Stage 3: Certificate
          const claims = await ledgerRepo.getClaims(orgId, projectId);
          const availableClaims = claims.filter(c => compareMoney(c.availableAmount, '0.00') > 0);
          let totalAvailable = '0.00';
          for (const c of availableClaims) {
            totalAvailable = addMoney(totalAvailable, c.availableAmount);
          }

          if (compareMoney(amount, totalAvailable) > 0) {
            return {
              success: false,
              error: `Nilai sertifikasi (${amount}) melebihi sisa klaim yang belum disetujui (${totalAvailable}).`
            };
          }

          let remainingToAllocate = amount;
          const allocations: {claimId: string; amount: string}[] = [];
          for (const claim of availableClaims) {
            if (compareMoney(remainingToAllocate, '0.00') <= 0) break;
            const allocAmount = compareMoney(remainingToAllocate, claim.availableAmount) < 0 ? remainingToAllocate : claim.availableAmount;
            allocations.push({claimId: claim.id, amount: allocAmount});
            remainingToAllocate = subtractMoney(remainingToAllocate, allocAmount);
          }

          await ledgerRepo.createCertificate({
            orgId,
            projectId,
            certificateNumber: reference,
            description: reason,
            allocations
          });
        } else if (stageIndex === 4) {
          // Stage 4: Project Invoice
          const certs = await ledgerRepo.getCertificates(orgId, projectId);
          const invs = await ledgerRepo.getProjectInvoices(orgId, projectId);
          let totalAvailable = '0.00';
          const certAvailableMap = new Map<string, string>();
          for (const k of certs) {
            const certDetail = await ledgerRepo.getCertificateById(orgId, projectId, k.id);
            const certTotal = certDetail?.totalAllocatedAmount || k.totalAllocatedAmount;
            let totalInvoicedForCert = '0.00';
            for (const inv of invs) {
              const invDetail = await ledgerRepo.getProjectInvoiceById(orgId, projectId, inv.id);
              if (invDetail?.allocations) {
                for (const pia of invDetail.allocations) {
                  if (pia.certificateId === k.id) {
                    totalInvoicedForCert = addMoney(totalInvoicedForCert, pia.allocatedAmount);
                  }
                }
              }
            }
            const avail = compareMoney(certTotal, totalInvoicedForCert) > 0 ? subtractMoney(certTotal, totalInvoicedForCert) : '0.00';
            certAvailableMap.set(k.id, avail);
            totalAvailable = addMoney(totalAvailable, avail);
          }

          if (compareMoney(amount, totalAvailable) > 0) {
            return {
              success: false,
              error: `Nilai invoice (${amount}) melebihi sisa sertifikasi yang belum ditagihkan (${totalAvailable}).`
            };
          }

          let remainingToAllocate = amount;
          const allocations: {certificateId: string; amount: string}[] = [];
          for (const k of certs) {
            if (compareMoney(remainingToAllocate, '0.00') <= 0) break;
            const avail = certAvailableMap.get(k.id) || '0.00';
            if (compareMoney(avail, '0.00') <= 0) continue;
            const allocAmount = compareMoney(remainingToAllocate, avail) < 0 ? remainingToAllocate : avail;
            allocations.push({certificateId: k.id, amount: allocAmount});
            remainingToAllocate = subtractMoney(remainingToAllocate, allocAmount);
          }

          await ledgerRepo.createProjectInvoice({
            orgId,
            projectId,
            invoiceNumber: reference,
            description: reason,
            allocations
          });
        } else if (stageIndex === 5) {
          // Stage 5: Cash Receipt
          const invs = await ledgerRepo.getProjectInvoices(orgId, projectId);
          const availableInvs = invs.filter(i => compareMoney(i.remainingAmount, '0.00') > 0);
          let totalAvailable = '0.00';
          for (const inv of availableInvs) {
            totalAvailable = addMoney(totalAvailable, inv.remainingAmount);
          }

          if (compareMoney(amount, totalAvailable) > 0) {
            return {
              success: false,
              error: `Nilai kas masuk (${amount}) melebihi sisa tagihan yang belum diterima (${totalAvailable}).`
            };
          }

          let remainingToAllocate = amount;
          const allocations: {invoiceId: string; amount: string}[] = [];
          for (const inv of availableInvs) {
            if (compareMoney(remainingToAllocate, '0.00') <= 0) break;
            const allocAmount = compareMoney(remainingToAllocate, inv.remainingAmount) < 0 ? remainingToAllocate : inv.remainingAmount;
            allocations.push({invoiceId: inv.id, amount: allocAmount});
            remainingToAllocate = subtractMoney(remainingToAllocate, allocAmount);
          }

          await ledgerRepo.createCashReceipt({
            orgId,
            projectId,
            receiptNumber: reference,
            receivedAmount: amount,
            description: reason,
            allocations
          });
        }

        const totals = await ledgerRepo.getLedgerTotals(orgId, projectId);
        const updatedValues: StageValues = [
          Number(totals.workPerformed),
          Number(totals.measured),
          Number(totals.claimed),
          Number(totals.certified),
          Number(totals.invoiced),
          Number(totals.collected)
        ];

        return {
          success: true,
          project: {
            ...project,
            values: updatedValues
          }
        };
      } catch (err: any) {
        return {success: false, error: err.message || 'Gagal mencatat mutasi ledger.'};
      }
    }

    // Fallback in-memory behavior (for isolated unit tests without orgId)
    const project = db.projects.find(p => p.id === projectId);
    if (!project) return {success: false, error: 'Proyek tidak ditemukan.'};
    const numAmount = Number(amount);
    if (stageIndex > 0 && numAmount > project.values[stageIndex - 1]) {
      return {success: false, error: 'Nilai tahap tidak boleh melebihi nilai tahap sebelumnya.'};
    }
    project.values[stageIndex] = numAmount;
    project.updated = '8 Sep 2026, 09.45';
    db.save();

    return {success: true, project};
  }
}
