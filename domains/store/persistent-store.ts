/**
 * Canonical Data Access Store
 * Backed strictly by Supabase / PostgreSQL via Database Adapter.
 * Zero reliance on localStorage for business records.
 */

import {
  dbAdapter,
  DashboardKpis,
  MoneyPipelineSummary,
  ProjectAttentionItem,
  PilotOrgRecord,
  DetailedFeedbackSubmission,
  ProspectLeadRecord,
  CustomerEvidenceRecord,
  EvidenceType,
  OutreachLogRecord,
  DiscoveryCallRecord,
  FounderMilestoneState,
  OutreachChannel,
} from "@/lib/db/database-adapter";

export class CoveDataStore {
  public get organizations() {
    return dbAdapter.getOrganizations();
  }

  public get realPilotOrganizations() {
    return dbAdapter.getRealPilotOrganizations();
  }

  public get demoOrganizations() {
    return dbAdapter.getDemoOrganizations();
  }

  public get realProspectLeads() {
    return dbAdapter.getRealProspectLeads();
  }

  public get demoProspectLeads() {
    return dbAdapter.getDemoProspectLeads();
  }

  public get outreachLogs() {
    return dbAdapter.getOutreachLogs();
  }

  public get discoveryCallRecords() {
    return dbAdapter.getDiscoveryCallRecords();
  }

  public get customerEvidenceLedger() {
    return dbAdapter.getCustomerEvidenceLedger();
  }

  public get milestoneState() {
    return dbAdapter.getMilestoneState();
  }

  public getRealRecruitmentMetrics() {
    return dbAdapter.getRealRecruitmentMetrics();
  }

  public getTodayActionItems() {
    return dbAdapter.getTodayActionItems();
  }

  public addRealProspect(lead: any) {
    return dbAdapter.addRealProspect(lead);
  }

  public updateProspectStatus(prospectId: string, updates: any) {
    return dbAdapter.updateProspectStatus(prospectId, updates);
  }

  public logOutreachAttempt(data: any) {
    return dbAdapter.logOutreachAttempt(data);
  }

  public recordDiscoveryCall(data: any) {
    return dbAdapter.recordDiscoveryCall(data);
  }

  public logCustomerEvidence(evidence: any) {
    return dbAdapter.logCustomerEvidence(evidence);
  }

  public exportRealPipelineCSV() {
    return dbAdapter.exportRealPipelineCSV();
  }

  public get profiles() {
    return dbAdapter.getProfiles();
  }

  public get clients() {
    return dbAdapter.getClients();
  }

  public get projects() {
    return dbAdapter.getProjects();
  }

  public get contracts() {
    return dbAdapter.getContracts();
  }

  public get claims() {
    return dbAdapter.getClaims();
  }

  public get invoices() {
    return dbAdapter.getInvoices();
  }

  public get blockers() {
    return dbAdapter.getBlockers();
  }

  public get actions() {
    return dbAdapter.getActions();
  }

  public get auditLogs() {
    return dbAdapter.getAuditLogs();
  }

  public get notifications() {
    return dbAdapter.getNotifications();
  }

  public get feedbackSubmissions() {
    return dbAdapter.getFeedbackSubmissions();
  }

  public getPilotValueSummary(orgId?: string) {
    return dbAdapter.getPilotValueSummary(orgId);
  }

  public getDashboardKpis(): DashboardKpis {
    return dbAdapter.getDashboardKpis();
  }

  public getMoneyPipeline(projectId?: string): MoneyPipelineSummary {
    return dbAdapter.getMoneyPipeline(projectId);
  }

  public getProjectsAttentionList(): ProjectAttentionItem[] {
    return dbAdapter.getProjectsAttentionList();
  }

  public getExpectedCollectionForecast() {
    return dbAdapter.getExpectedCollectionForecast();
  }

  public createOrganization(data: any) {
    return dbAdapter.createOrganization(data);
  }

  public createProject(project: any, contract: any) {
    return dbAdapter.createProject(project, contract);
  }

  public createClaim(claimData: any) {
    return dbAdapter.createClaim(claimData);
  }

  public updateClaimCertifiedValue(claimId: string, newCertifiedValue: number, user?: string) {
    return dbAdapter.updateClaimCertifiedValue(claimId, newCertifiedValue, user);
  }

  public transitionClaim(claimId: string, targetStage: any, reason?: string, userId?: string) {
    return dbAdapter.transitionClaim(claimId, targetStage, reason, userId);
  }

  public createBlocker(blockerData: any) {
    return dbAdapter.createBlocker(blockerData);
  }

  public resolveBlocker(blockerId: string, resolutionNote: string) {
    return dbAdapter.resolveBlocker(blockerId, resolutionNote);
  }

  public createAction(actionData: any) {
    return dbAdapter.createAction(actionData);
  }

  public resolveAction(
    actionId: string,
    resolutionNotes: string,
    outcomeType: any,
    outcomeValue?: number,
    closureEvidenceUrl?: string,
    closureEvidenceNote?: string,
    actorName?: string
  ) {
    return dbAdapter.resolveAction(
      actionId,
      resolutionNotes,
      outcomeType,
      outcomeValue,
      closureEvidenceUrl,
      closureEvidenceNote,
      actorName
    );
  }

  public createInvoice(invoice: any) {
    return dbAdapter.createInvoice(invoice);
  }

  public recordCashReceipt(data: any) {
    return dbAdapter.recordCashReceipt(data);
  }

  public submitDetailedFeedback(feedback: any) {
    return dbAdapter.submitDetailedFeedback(feedback);
  }

  // Phase 2: RBAC & Tenant Security
  public getProjectMembers(projectId?: string) {
    return dbAdapter.getProjectMembers(projectId);
  }

  public assignProjectMember(projectId: string, userId: string, roleInProject?: string, actorName?: string) {
    return dbAdapter.assignProjectMember(projectId, userId, roleInProject, actorName);
  }

  public removeProjectMember(projectId: string, userId: string, actorName?: string) {
    return dbAdapter.removeProjectMember(projectId, userId, actorName);
  }

  public checkUserProjectAccess(userId: string, projectId: string) {
    return dbAdapter.checkUserProjectAccess(userId, projectId);
  }

  public deactivateUser(userId: string, reason: string, actorName?: string) {
    return dbAdapter.deactivateUser(userId, reason, actorName);
  }

  public activateUser(userId: string, actorName?: string) {
    return dbAdapter.activateUser(userId, actorName);
  }

  public inviteUser(userData: any, actorName?: string) {
    return dbAdapter.inviteUser(userData, actorName);
  }

  public grantAssistedAccess(data: any, actorName?: string) {
    return dbAdapter.grantAssistedAccess(data, actorName);
  }

  public revokeAssistedAccess(grantId: string, actorName?: string) {
    return dbAdapter.revokeAssistedAccess(grantId, actorName);
  }

  public getAssistedAccessGrants(orgId?: string) {
    return dbAdapter.getAssistedAccessGrants(orgId);
  }

  public exportFullTenantData(orgId?: string) {
    return dbAdapter.exportFullTenantData(orgId);
  }

  public softDeleteEntity(entityType: "claim" | "project" | "action" | "blocker", entityId: string, actorName?: string) {
    return dbAdapter.softDeleteEntity(entityType, entityId, actorName);
  }

  public restoreEntity(entityType: "claim" | "project" | "action" | "blocker", entityId: string, actorName?: string) {
    return dbAdapter.restoreEntity(entityType, entityId, actorName);
  }

  // Phase 3: Project Intake & Contract Rule Foundation
  public get contractRuleVersions() {
    return dbAdapter.getContractRuleVersions();
  }

  public getContractRuleVersions(projectId?: string) {
    return dbAdapter.getContractRuleVersions(projectId);
  }

  public getActiveContractRule(projectId: string) {
    return dbAdapter.getActiveContractRule(projectId);
  }

  public createClient(clientData: any, actorName?: string) {
    return dbAdapter.createClient(clientData, actorName);
  }

  public createProjectWithContract(data: any, actorName?: string) {
    return dbAdapter.createProjectWithContract(data, actorName);
  }

  public proposeContractRuleVersion(ruleData: any, actorName?: string) {
    return dbAdapter.proposeContractRuleVersion(ruleData, actorName);
  }

  public approveContractRuleVersion(versionId: string, approverName?: string) {
    return dbAdapter.approveContractRuleVersion(versionId, approverName);
  }

  // Phase 4: Excel/CSV Import & Reconciliation Engine
  public get sourceImports() {
    return dbAdapter.getSourceImports();
  }

  public getSourceImports(projectId?: string) {
    return dbAdapter.getSourceImports(projectId);
  }

  public get importTemplates() {
    return dbAdapter.getImportTemplates();
  }

  public getImportTemplates(entityType?: "claims" | "projects" | "invoices") {
    return dbAdapter.getImportTemplates(entityType);
  }

  public saveImportTemplate(template: any, actorName?: string) {
    return dbAdapter.saveImportTemplate(template, actorName);
  }

  public checkDuplicateFile(fileChecksum: string, projectId?: string) {
    return dbAdapter.checkDuplicateFile(fileChecksum, projectId);
  }

  public commitImportBatch(data: any, actorName?: string) {
    return dbAdapter.commitImportBatch(data, actorName);
  }

  public rollbackImportBatch(importBatchId: string, reason: string, actorName?: string) {
    return dbAdapter.rollbackImportBatch(importBatchId, reason, actorName);
  }

  // Phase 5: Value Gap Ledger & Stage Engine
  public updateClaimControllability(
    claimId: string,
    controllability: "INTERNAL" | "JOINT" | "EXTERNAL" | "UNKNOWN",
    actorName?: string
  ) {
    return dbAdapter.updateClaimControllability(claimId, controllability, actorName);
  }

  public markClaimDisputed(claimId: string, reason: string, actorName?: string) {
    return dbAdapter.markClaimDisputed(claimId, reason, actorName);
  }

  public writeOffClaim(claimId: string, amount: number, reason: string, actorName?: string) {
    return dbAdapter.writeOffClaim(claimId, amount, reason, actorName);
  }

  public recertifyClaimWithVariance(
    claimId: string,
    certifiedValue: number,
    actorName?: string,
    notes?: string
  ) {
    return dbAdapter.recertifyClaimWithVariance(claimId, certifiedValue, actorName, notes);
  }

  // Phase 6: Claim Readiness Gate (RDY-001..013)
  public getContractChecklists(projectId?: string) {
    return dbAdapter.getContractChecklists(projectId);
  }

  public getActiveContractChecklist(projectId: string) {
    return dbAdapter.getActiveContractChecklist(projectId);
  }

  public getContractChecklistItems(checklistId: string) {
    return dbAdapter.getContractChecklistItems(checklistId);
  }

  public getClaimReadinessItems(claimId: string) {
    return dbAdapter.getClaimReadinessItems(claimId);
  }

  public updateClaimReadinessItem(
    claimId: string,
    itemId: string,
    updates: any,
    actorName?: string
  ) {
    return dbAdapter.updateClaimReadinessItem(claimId, itemId, updates, actorName);
  }

  public assignMissingItemAction(
    claimId: string,
    itemId: string,
    ownerName: string,
    dueDate: string,
    actorName?: string
  ) {
    return dbAdapter.assignMissingItemAction(claimId, itemId, ownerName, dueDate, actorName);
  }

  public overrideClaimReadiness(
    claimId: string,
    approverName: string,
    reason: string
  ) {
    return dbAdapter.overrideClaimReadiness(claimId, approverName, reason);
  }

  public reopenClaimAfterRejection(
    claimId: string,
    rejectionReason: string,
    actorName?: string
  ) {
    return dbAdapter.reopenClaimAfterRejection(claimId, rejectionReason, actorName);
  }

  public copyChecklistToClaim(
    claimId: string,
    projectId: string,
    actorName?: string
  ) {
    return dbAdapter.copyChecklistToClaim(claimId, projectId, actorName);
  }

  // Phase 7: Action & Escalation Queue (ACT-001..015)
  public reopenAction(actionId: string, reopenReason: string, actorName?: string) {
    return dbAdapter.reopenAction(actionId, reopenReason, actorName);
  }

  public bulkAssignActions(actionIds: string[], newOwnerId: string, newOwnerName: string, actorName?: string) {
    return dbAdapter.bulkAssignActions(actionIds, newOwnerId, newOwnerName, actorName);
  }

  public bulkDueDateActions(actionIds: string[], newDueDate: string, actorName?: string) {
    return dbAdapter.bulkDueDateActions(actionIds, newDueDate, actorName);
  }

  public addActionComment(actionId: string, content: string, authorName?: string) {
    return dbAdapter.addActionComment(actionId, content, authorName);
  }

  public createWeeklySnapshot(snapshotData: any, actorName?: string) {
    return dbAdapter.createWeeklySnapshot(snapshotData, actorName);
  }

  public getWeeklySnapshots(projectId?: string) {
    return dbAdapter.getWeeklySnapshots(projectId);
  }

  // Phase 8: Project Baseline Locking (PRT-009, UAT-15)
  public getProjectBaselines(projectId?: string) {
    return dbAdapter.getProjectBaselines(projectId);
  }

  public lockProjectBaseline(
    projectId: string,
    baselineExposure: number,
    baselineCycleDays: number,
    lockReason: string,
    actorName?: string
  ) {
    return dbAdapter.lockProjectBaseline(projectId, baselineExposure, baselineCycleDays, lockReason, actorName);
  }

  // Phase 9: Saved Filter Views (PLT-014)
  public getSavedFilterViews(pageContext?: string) {
    return dbAdapter.getSavedFilterViews(pageContext);
  }

  public saveFilterView(
    viewName: string,
    pageContext: string,
    filterCriteria: Record<string, any>,
    userId?: string
  ) {
    return dbAdapter.saveFilterView(viewName, pageContext, filterCriteria, userId);
  }

  public deleteSavedFilterView(viewId: string) {
    return dbAdapter.deleteSavedFilterView(viewId);
  }

  // Phase 10: Onboarding & Pilot Scorecard (PRD 23, 28)
  public getDataAcceptanceItems(projectId?: string) {
    return dbAdapter.getDataAcceptanceItems(projectId);
  }

  public updateDataAcceptanceItem(
    itemId: string,
    status: "PENDING" | "VERIFIED" | "WAIVED",
    verifiedByName: string,
    notes?: string
  ) {
    return dbAdapter.updateDataAcceptanceItem(itemId, status, verifiedByName, notes);
  }

  public getPilotScorecards(projectId?: string) {
    return dbAdapter.getPilotScorecards(projectId);
  }

  public savePilotScorecard(scorecard: any) {
    return dbAdapter.savePilotScorecard(scorecard);
  }
}

export const coveStore = new CoveDataStore();
export type {
  DashboardKpis,
  MoneyPipelineSummary,
  ProjectAttentionItem,
  PilotOrgRecord,
  DetailedFeedbackSubmission,
  ProspectLeadRecord,
  CustomerEvidenceRecord,
  EvidenceType,
  OutreachLogRecord,
  DiscoveryCallRecord,
  FounderMilestoneState,
  OutreachChannel,
};
