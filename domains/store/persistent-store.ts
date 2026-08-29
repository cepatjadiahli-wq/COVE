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

  public resolveAction(actionId: string, resolutionNotes: string, outcomeType: any, outcomeValue?: number) {
    return dbAdapter.resolveAction(actionId, resolutionNotes, outcomeType, outcomeValue);
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
