#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * COVE Phase 18R.1: Static Secret Leak Scanner for Client Production Bundles & Source
 * 
 * Rules:
 * 1. Reads actual secret values from process.env and searches client bundles/sources for the literal values.
 * 2. Emits explicit status per secret:
 *    - SECRET_VALUE_SCANNED_AND_NOT_FOUND: Actual value was verified absent from client files.
 *    - SECRET_ENV_NOT_AVAILABLE: Environment secret was not set in runtime; cannot scan value (does NOT falsely claim safe).
 *    - FORBIDDEN_ENV_NAME_FOUND: Secret identifier referenced in client-facing code.
 *    - SECRET_LEAK_DETECTED: Secret value or sensitive credential found in client bundle.
 * 3. Scans source maps, manifests, and NEXT_PUBLIC_* variables.
 * 4. Fails with non-zero exit code on SECRET_LEAK_DETECTED or FORBIDDEN_ENV_NAME_FOUND.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const TARGET_DIRS = [
  path.join(ROOT_DIR, ".next", "static"),
  path.join(ROOT_DIR, "components"),
  path.join(ROOT_DIR, "app", "(app)"),
  path.join(ROOT_DIR, "app", "admin"),
];

// Sensitive secrets to monitor
const MONITORED_SECRETS = [
  { envVar: "SUPABASE_SERVICE_ROLE_KEY", description: "Supabase service role administrative secret key" },
  { envVar: "CRON_SECRET", description: "Internal billing cron execution secret" },
  { envVar: "MAYAR_API_KEY", description: "Mayar payment gateway secret API key" },
  { envVar: "MAYAR_WEBHOOK_SECRET", description: "Mayar webhook verification secret token" },
  { envVar: "XENDIT_SECRET_KEY", description: "Xendit gateway API secret key" },
  { envVar: "XENDIT_WEBHOOK_TOKEN", altEnvVar: "XENDIT_CALLBACK_TOKEN", description: "Xendit webhook verification token" },
  { envVar: "DATABASE_URL", description: "PostgreSQL administrative connection string" },
];

// Forbidden identifier patterns that should never appear in client bundles
const FORBIDDEN_PATTERNS = [
  { name: "SUPABASE_SERVICE_ROLE_KEY identifier", pattern: /SUPABASE_SERVICE_ROLE_KEY/ },
  { name: "CRON_SECRET identifier", pattern: /CRON_SECRET/ },
  { name: "MAYAR_API_KEY identifier", pattern: /MAYAR_API_KEY/ },
  { name: "MAYAR_WEBHOOK_SECRET identifier", pattern: /MAYAR_WEBHOOK_SECRET/ },
  { name: "XENDIT_SECRET_KEY identifier", pattern: /XENDIT_SECRET_KEY/ },
  { name: "XENDIT_WEBHOOK_TOKEN identifier", pattern: /XENDIT_WEBHOOK_TOKEN/ },
  { name: "Default service_role JWT payload", pattern: /eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZS/ },
  { name: "Default CRON secret literal", pattern: /cove_internal_cron_secret_key/ },
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      // Scan code, manifests, source maps, and HTML
      if ([".js", ".jsx", ".ts", ".tsx", ".json", ".map", ".html", ".mjs"].includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  }
  return arrayOfFiles;
}

function runScanner() {
  console.log("================================================================================");
  console.log("  COVE PHASE 18R.1: ENHANCED STATIC CLIENT BUNDLE SECRET SCANNER");
  console.log("================================================================================");

  let totalFilesScanned = 0;
  const violations = [];
  const statusReport = [];

  // 1. Gather all files to inspect
  const allFiles = [];
  for (const targetDir of TARGET_DIRS) {
    const relDir = path.relative(ROOT_DIR, targetDir);
    if (!fs.existsSync(targetDir)) {
      console.log(`[INFO] Directory not present yet: ${relDir}`);
      continue;
    }
    const files = getAllFiles(targetDir);
    console.log(`[SCANNING] ${relDir} (${files.length} files)...`);
    allFiles.push(...files);
  }

  totalFilesScanned = allFiles.length;

  // 2. Pre-read file contents for fast searching
  const fileContents = allFiles.map((f) => ({
    path: path.relative(ROOT_DIR, f),
    content: fs.readFileSync(f, "utf8"),
  }));

  // 3. Scan for Forbidden Identifiers
  for (const file of fileContents) {
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(file.content)) {
        violations.push({
          status: "FORBIDDEN_ENV_NAME_FOUND",
          file: file.path,
          detail: rule.name,
        });
      }
    }
  }

  // 4. Scan for Actual Secret Values
  for (const secret of MONITORED_SECRETS) {
    const secretValue = process.env[secret.envVar] || (secret.altEnvVar ? process.env[secret.altEnvVar] : undefined);

    if (!secretValue || secretValue.trim().length < 8) {
      statusReport.push({
        envVar: secret.envVar,
        status: "SECRET_ENV_NOT_AVAILABLE",
        detail: "Secret not present in current process.env (or under 8 chars); literal scan skipped.",
      });
      console.log(`[WARN]  ${secret.envVar}: SECRET_ENV_NOT_AVAILABLE (Skipping literal value search)`);
      continue;
    }

    let leakFound = false;
    for (const file of fileContents) {
      if (file.content.includes(secretValue.trim())) {
        violations.push({
          status: "SECRET_LEAK_DETECTED",
          file: file.path,
          detail: `Actual secret value of ${secret.envVar} leaked in client bundle`,
        });
        leakFound = true;
      }
    }

    if (!leakFound) {
      statusReport.push({
        envVar: secret.envVar,
        status: "SECRET_VALUE_SCANNED_AND_NOT_FOUND",
        detail: "Actual secret value verified absent across all client files.",
      });
      console.log(`[PASS]  ${secret.envVar}: SECRET_VALUE_SCANNED_AND_NOT_FOUND`);
    }
  }

  // 5. Audit NEXT_PUBLIC_* Environment Variables
  const nextPublicKeys = Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_"));
  console.log(`[AUDIT] Inspected ${nextPublicKeys.length} NEXT_PUBLIC_* variables.`);
  for (const npKey of nextPublicKeys) {
    const val = process.env[npKey] || "";
    for (const secret of MONITORED_SECRETS) {
      const secVal = process.env[secret.envVar];
      if (secVal && secVal.length >= 8 && val.includes(secVal)) {
        violations.push({
          status: "SECRET_LEAK_DETECTED",
          file: `process.env.${npKey}`,
          detail: `NEXT_PUBLIC variable contains secret value of ${secret.envVar}`,
        });
      }
    }
  }

  console.log("--------------------------------------------------------------------------------");
  console.log(`  Total client-facing files inspected: ${totalFilesScanned}`);

  if (violations.length > 0) {
    console.error(`❌ CRITICAL SECURITY VIOLATION: ${violations.length} issue(s) detected!`);
    for (const v of violations) {
      console.error(`   - [${v.status}] ${v.detail} (in: ${v.file})`);
    }
    console.log("================================================================================");
    if (require.main === module) {
      process.exit(1);
    }
    return { success: false, violations, statusReport, filesScanned: totalFilesScanned };
  }

  console.log("✔ SECURITY SCAN PASSED: Zero secret leaks or forbidden identifiers detected.");
  console.log("================================================================================");
  return { success: true, violations: [], statusReport, filesScanned: totalFilesScanned };
}

if (require.main === module) {
  const res = runScanner();
  if (!res.success) {
    process.exit(1);
  }
}

module.exports = { runScanner };
