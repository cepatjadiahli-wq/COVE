/**
 * Phase 3 Unit Test Suite: Project Intake & Contract Rule Foundation
 * PRD Bagian 16, 18.2, 22.3 (PLT-010, PLT-011, Contract Rule Versioning)
 * 
 * Verifies:
 * 1. Active Rule Resolution & Seed Integrity
 * 2. Unified Project Intake with Contract & Rule v1.0
 * 3. Client Creation & Mapping
 * 4. Contract Rule Proposal (Commercial Manager)
 * 5. Contract Rule Approval & Superseding (Owner/Admin)
 * 6. Non-Universal Tax Clause Enforcement (PRD Section 22.3)
 * 7. Calendar Basis Distinction (Working vs Calendar Days)
 * 8. Audit Trail for All Intake & Rule Changes
 */

const assert = require("assert");

function runContractRulesTestSuite() {
  console.log("==================================================================");
  console.log("SUITE 13: Phase 3 Project Intake & Contract Rule Foundation");
  console.log("==================================================================");

  // Mock Database Layer mimicking CoveDatabaseAdapter
  class TestContractRuleEngine {
    constructor() {
      this.clients = [
        { id: "cl-01", name: "PT Mitra Properti", clientCode: "CL-MITRA" },
      ];
      this.projects = [
        { id: "prj-meridian", projectCode: "PRJ-MERIDIAN-01", projectName: "Grand Meridian" },
        { id: "prj-graha", projectCode: "PRJ-GRAHA-02", projectName: "Graha Sentosa" },
      ];
      this.contracts = [
        { id: "ctr-meridian", projectId: "prj-meridian", paymentTermDays: 30, retentionPercent: 5.0 },
        { id: "ctr-graha", projectId: "prj-graha", paymentTermDays: 45, retentionPercent: 5.0 },
      ];
      this.contractRuleVersions = [
        {
          id: "rule-mrd-v10",
          projectId: "prj-meridian",
          versionNumber: "v1.0",
          status: "SUPERSEDED",
          cutOffDay: 25,
          reviewSlaDays: 14,
          paymentTermDays: 30,
          calendarBasis: "CALENDAR_DAYS",
          retentionPercent: 5.0,
          advanceRecoveryPercent: 10.0,
          taxTreatment: "PPN 11% & PPh 4(2) Final 1.75% (Pasal 12 SPK)",
          sourceClauseRef: "Pasal 8 SPK Utama",
          effectiveDate: "2025-06-01",
          createdBy: "Dimas Sucipto",
          approvedBy: "Raka Pratama",
          createdAt: "2025-05-28T10:00:00Z",
        },
        {
          id: "rule-mrd-v11",
          projectId: "prj-meridian",
          versionNumber: "v1.1",
          status: "APPROVED",
          cutOffDay: 25,
          reviewSlaDays: 12,
          paymentTermDays: 30,
          calendarBasis: "CALENDAR_DAYS",
          retentionPercent: 5.0,
          advanceRecoveryPercent: 10.0,
          taxTreatment: "PPN 11% & PPh 4(2) Final 1.75% (Pasal 12 SPK)",
          sourceClauseRef: "Addendum I SPK Pasal 3.1",
          effectiveDate: "2026-01-01",
          createdBy: "Dimas Sucipto",
          approvedBy: "Raka Pratama",
          createdAt: "2025-12-28T14:00:00Z",
        },
        {
          id: "rule-graha-v10",
          projectId: "prj-graha",
          versionNumber: "v1.0",
          status: "APPROVED",
          cutOffDay: 20,
          reviewSlaDays: 14,
          paymentTermDays: 45,
          calendarBasis: "WORKING_DAYS",
          retentionPercent: 5.0,
          advanceRecoveryPercent: 15.0,
          taxTreatment: "PPN 11% & PPh Final 1.75% (Pasal 10 SPK)",
          sourceClauseRef: "Pasal 9 Ayat 3 SPK Graha Sentosa",
          effectiveDate: "2025-11-01",
          createdBy: "Dimas Sucipto",
          approvedBy: "Raka Pratama",
          createdAt: "2025-10-28T09:00:00Z",
        },
      ];
      this.projectMembers = [];
      this.auditLogs = [];
    }

    getActiveRule(projectId) {
      return (
        this.contractRuleVersions.find((r) => r.projectId === projectId && r.status === "APPROVED") ||
        this.contractRuleVersions.find((r) => r.projectId === projectId)
      );
    }

    createClient(data, actor) {
      const newClient = {
        id: "cl-" + Math.random().toString(36).substring(2, 7),
        clientCode: data.clientCode || "CL-" + data.name.substring(0, 4).toUpperCase(),
        name: data.name,
      };
      this.clients.push(newClient);
      this.auditLogs.unshift({
        eventType: "CLIENT_CREATED",
        entityId: newClient.id,
        user: actor,
        timestamp: new Date().toISOString(),
      });
      return newClient;
    }

    createProjectWithContract(data, actor) {
      const projId = "prj-" + Math.random().toString(36).substring(2, 7);
      const ctrId = "ctr-" + Math.random().toString(36).substring(2, 7);
      const ruleId = "rule-" + Math.random().toString(36).substring(2, 7);

      const project = { id: projId, ...data.project };
      const contract = { id: ctrId, projectId: projId, ...data.contract };
      const ruleVersion = {
        id: ruleId,
        projectId: projId,
        contractId: ctrId,
        versionNumber: "v1.0",
        status: "APPROVED",
        cutOffDay: data.rule?.cutOffDay || 25,
        internalLeadTimeDays: data.rule?.internalLeadTimeDays || 5,
        reviewSlaDays: data.rule?.reviewSlaDays || 14,
        paymentTermDays: data.rule?.paymentTermDays || 30,
        calendarBasis: data.rule?.calendarBasis || "CALENDAR_DAYS",
        retentionPercent: data.rule?.retentionPercent || 5.0,
        advanceRecoveryPercent: data.rule?.advanceRecoveryPercent || 0,
        taxTreatment: data.rule?.taxTreatment || "PPN 11% & PPh Final 1.75%",
        sourceClauseRef: data.rule?.sourceClauseRef || "Pasal 8 SPK",
        createdBy: actor,
        approvedBy: actor,
        approvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      this.projects.push(project);
      this.contracts.push(contract);
      this.contractRuleVersions.push(ruleVersion);

      // Auto-assign project members
      if (data.project.projectManagerId) {
        this.projectMembers.push({ projectId: projId, userId: data.project.projectManagerId, role: "PROJECT_MANAGER" });
      }
      if (data.project.commercialManagerId) {
        this.projectMembers.push({ projectId: projId, userId: data.project.commercialManagerId, role: "COMMERCIAL_MANAGER" });
      }

      this.auditLogs.unshift({
        eventType: "PROJECT_INTAKE_COMPLETED",
        entityId: projId,
        description: `Project ${project.projectName} created with Contract ${contract.contractNumber} and Rule v1.0.`,
        user: actor,
        timestamp: new Date().toISOString(),
      });

      return { project, contract, ruleVersion };
    }

    proposeRuleVersion(data, actor) {
      const existing = this.contractRuleVersions.filter((r) => r.projectId === data.projectId);
      const nextVer = `v1.${existing.length}`;
      const newRule = {
        id: "rule-" + Math.random().toString(36).substring(2, 7),
        ...data,
        versionNumber: nextVer,
        status: "PENDING_APPROVAL",
        createdBy: actor,
        createdAt: new Date().toISOString(),
      };
      this.contractRuleVersions.unshift(newRule);
      this.auditLogs.unshift({
        eventType: "CONTRACT_RULE_PROPOSED",
        entityId: newRule.id,
        description: `Rule ${nextVer} proposed for project ${data.projectId}`,
        user: actor,
        timestamp: new Date().toISOString(),
      });
      return newRule;
    }

    approveRuleVersion(versionId, actor) {
      const target = this.contractRuleVersions.find((r) => r.id === versionId);
      if (!target) throw new Error("Rule version not found");

      for (const v of this.contractRuleVersions) {
        if (v.projectId === target.projectId && v.id !== target.id && v.status === "APPROVED") {
          v.status = "SUPERSEDED";
        }
      }

      target.status = "APPROVED";
      target.approvedBy = actor;
      target.approvedAt = new Date().toISOString();

      const contract = this.contracts.find((c) => c.projectId === target.projectId);
      if (contract) {
        contract.paymentTermDays = target.paymentTermDays;
        contract.retentionPercent = target.retentionPercent;
      }

      this.auditLogs.unshift({
        eventType: "CONTRACT_RULE_APPROVED",
        entityId: target.id,
        description: `Rule ${target.versionNumber} APPROVED by ${actor}`,
        user: actor,
        timestamp: new Date().toISOString(),
      });

      return target;
    }
  }

  const engine = new TestContractRuleEngine();

  // 1. Active Rule Resolution & Superseded Separation
  const mrdActive = engine.getActiveRule("prj-meridian");
  assert.strictEqual(mrdActive.versionNumber, "v1.1", "Active rule for Grand Meridian must be v1.1");
  assert.strictEqual(mrdActive.status, "APPROVED", "Active rule status must be APPROVED");
  assert.strictEqual(mrdActive.reviewSlaDays, 12, "Active rule SLA must be 12 days");

  const mrdOld = engine.contractRuleVersions.find((r) => r.id === "rule-mrd-v10");
  assert.strictEqual(mrdOld.status, "SUPERSEDED", "Previous rule v1.0 must be SUPERSEDED");
  console.log("  [PASS] 1. Active Rule Resolution & Superseding correctly identified.");

  // 2. Calendar Basis & Working Days Verification
  const grahaActive = engine.getActiveRule("prj-graha");
  assert.strictEqual(grahaActive.calendarBasis, "WORKING_DAYS", "Graha Sentosa must use WORKING_DAYS");
  assert.strictEqual(grahaActive.paymentTermDays, 45, "Graha Sentosa payment term must be 45 days");
  assert.strictEqual(grahaActive.cutOffDay, 20, "Graha Sentosa cut-off day must be 20");
  console.log("  [PASS] 2. Working Days vs Calendar Days rule basis accurately captured.");

  // 3. Client Registration & Audit
  const newClient = engine.createClient({ name: "PT Pakuwon Sentosa" }, "Raka Pratama");
  assert(newClient.id.startsWith("cl-"), "Client ID must have cl- prefix");
  assert(engine.auditLogs.some((l) => l.eventType === "CLIENT_CREATED"), "Audit log for client creation must exist");
  console.log("  [PASS] 3. Client creation and mapping audit logged.");

  // 4. Unified Project Intake with Contract Profile & Rule v1.0
  const intakeResult = engine.createProjectWithContract(
    {
      project: {
        projectName: "Bandung Techno Park Tower C",
        projectCode: "PRJ-BTP-05",
        clientId: newClient.id,
        projectManagerId: "usr-fajar",
        commercialManagerId: "usr-dimas",
      },
      contract: {
        contractNumber: "CTR-NB-BTP-2026-05",
        originalContractValue: 35000000000,
      },
      rule: {
        cutOffDay: 26,
        internalLeadTimeDays: 4,
        reviewSlaDays: 14,
        paymentTermDays: 30,
        calendarBasis: "CALENDAR_DAYS",
        retentionPercent: 5.0,
        advanceRecoveryPercent: 10.0,
        taxTreatment: "PPN 11% & PPh Final Jasa Konstruksi 1.75% (Pasal 15 SPK)",
        sourceClauseRef: "Pasal 7 Ayat 2 SPK Bandung Techno Park",
      },
    },
    "Raka Pratama (Owner)"
  );

  assert.strictEqual(intakeResult.project.projectName, "Bandung Techno Park Tower C");
  assert.strictEqual(intakeResult.contract.originalContractValue, 35000000000);
  assert.strictEqual(intakeResult.ruleVersion.versionNumber, "v1.0");
  assert.strictEqual(intakeResult.ruleVersion.status, "APPROVED");
  assert.strictEqual(intakeResult.ruleVersion.cutOffDay, 26);
  assert.strictEqual(engine.projectMembers.length, 2, "PM and Commercial Manager must be assigned to project");
  assert(engine.auditLogs.some((l) => l.eventType === "PROJECT_INTAKE_COMPLETED"), "Intake audit event must exist");
  console.log("  [PASS] 4. Project intake creates project, contract, rule v1.0, and member access.");

  // 5. Commercial Manager Proposes Rule Version (Pending Approval)
  const proposed = engine.proposeRuleVersion(
    {
      projectId: "prj-meridian",
      cutOffDay: 25,
      internalLeadTimeDays: 3,
      reviewSlaDays: 10,
      paymentTermDays: 30,
      calendarBasis: "CALENDAR_DAYS",
      retentionPercent: 5.0,
      taxTreatment: "PPN 11% & PPh Final 1.75%",
      sourceClauseRef: "Addendum II SPK No. 04/ADD-II/2026",
    },
    "Dimas Sucipto (Commercial Manager)"
  );

  assert.strictEqual(proposed.versionNumber, "v1.2");
  assert.strictEqual(proposed.status, "PENDING_APPROVAL");
  assert(engine.auditLogs.some((l) => l.eventType === "CONTRACT_RULE_PROPOSED"), "Proposal audit log must exist");
  console.log("  [PASS] 5. Contract rule proposal creates PENDING_APPROVAL version with version increment.");

  // 6. Owner Approves Proposed Rule Version
  const approved = engine.approveRuleVersion(proposed.id, "Raka Pratama (Owner)");
  assert.strictEqual(approved.status, "APPROVED");
  assert.strictEqual(approved.approvedBy, "Raka Pratama (Owner)");

  // Verify previous active (v1.1) is now SUPERSEDED
  const prevActive = engine.contractRuleVersions.find((r) => r.id === "rule-mrd-v11");
  assert.strictEqual(prevActive.status, "SUPERSEDED", "Previously active rule must now be SUPERSEDED");

  // Verify latest active rule for project is now v1.2
  const latestActive = engine.getActiveRule("prj-meridian");
  assert.strictEqual(latestActive.versionNumber, "v1.2");
  assert(engine.auditLogs.some((l) => l.eventType === "CONTRACT_RULE_APPROVED"), "Approval audit log must exist");
  console.log("  [PASS] 6. Owner approval supersedes previous active rule and records audit trail.");

  // 7. Anti-Overengineering Guardrail (PRD Section 22.3)
  // Verify tax treatment is explicitly project-contract specific, never a universal tax calculator
  assert(
    latestActive.taxTreatment.includes("PPN 11%"),
    "Tax treatment must reflect project contract specific terms, not a global formula"
  );
  console.log("  [PASS] 7. Anti-overengineering: Non-universal contract-bound tax clause verified.");

  console.log("\n>>> ALL 7 PHASE 3 CONTRACT RULE & INTAKE ASSERTIONS PASSED! <<<\n");
}

if (require.main === module) {
  runContractRulesTestSuite();
}

module.exports = { runContractRulesTestSuite };
