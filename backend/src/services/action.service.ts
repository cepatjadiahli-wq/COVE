// ============================================================================
// COVE Backend — Commercial Action Service v2.1
// Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §8
// ============================================================================

import {db} from '../db/store.js';
import {config} from '../config.js';
import type {ActionEntity} from '../types/domain.js';

export class ActionService {
  /**
   * Menghitung keterlambatan (overdue) berdasarkan tanggal acuan operasional
   */
  public static calculateDaysOverdue(dueDate: string, asOf = config.asOfDate): number {
    const diff = Date.parse(asOf) - Date.parse(dueDate);
    return Math.max(0, Math.floor(diff / 86400000));
  }

  /**
   * Membuat item tindakan baru
   */
  public static createAction(data: {
    projectId: string;
    title: string;
    blocker: string;
    owner: string;
    due: string;
    severity: ActionEntity['severity'];
    value: number;
  }): ActionEntity {
    const newAction: ActionEntity = {
      id: 'a' + (db.actions.length + 1),
      projectId: data.projectId,
      title: data.title,
      blocker: data.blocker,
      owner: data.owner,
      due: data.due,
      severity: data.severity,
      value: data.value,
      status: 'Terbuka',
      notes: []
    };

    db.actions.unshift(newAction);
    db.save();
    return newAction;
  }

  /**
   * Menambahkan catatan kronologis atau menyelesaikan tindakan
   */
  public static addNoteOrResolve(
    actionId: string,
    note: string,
    author: string,
    resolve = false
  ): {success: boolean; action?: ActionEntity; error?: string} {
    const action = db.actions.find(a => a.id === actionId);
    if (!action) return {success: false, error: 'Tindakan tidak ditemukan.'};

    if (note.trim()) {
      action.notes.push(`8 Sep · ${author}: ${note}`);
    }

    if (resolve) {
      action.status = 'Selesai';
    }

    db.save();
    return {success: true, action};
  }
}
