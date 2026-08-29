# COVE V1 — Staging Deployment & Environment Architecture

## 1. Three-Tier Environment Architecture

To guarantee security, isolation, and reliable testing, COVE operates on three distinct environments:

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│   LOCAL / DEVELOPMENT   │     │    STAGING / PILOT      │     │  PRODUCTION / CUSTOMER  │
├─────────────────────────┤     ├─────────────────────────┤     ├─────────────────────────┤
│ • localhost:3000        │     │ • cove-staging.vercel   │     │ • app.cove.id           │
│ • Local Node.js runtime │     │ • Isolated Staging DB   │     │ • Dedicated Prod DB     │
│ • Unit & Fast Dev Loop  │     │ • Founder UAT & Demos   │     │ • Paying Customers Only │
│ • Fictional Scratch DB  │     │ • Controlled Pilots     │     │ • Zero Test/Demo Data   │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

---

## 2. Vercel Staging Deployment Workflow

### Git Branching Model:
- **`main`**: Protected branch reserved for final public production releases.
- **`staging`**: Dedicated staging branch automatically deployed to Vercel Staging environment.

### Steps to Deploy Staging:
1. Create and checkout the `staging` branch:
   ```bash
   git checkout -b staging
   git push origin staging
   ```
2. In the **Vercel Project Settings**:
   - Link the repository.
   - Set **Preview Branch** or **Custom Environment** to `staging`.
   - Set Environment Variables using `.env.staging.example`.
3. Vercel builds the deployment with Next.js 16.3.3 and generates the HTTPS staging URL:
   `https://cove-staging.vercel.app`

---

## 3. Staging Demo Credentials & Personas

The staging environment is preloaded with `PT Nusantara Buildindo` and 5 active personas:

| Persona | Role | Default Email | Staging Password | Primary Use Case in UAT |
| :--- | :--- | :--- | :--- | :--- |
| **Raka Pratama** | `OWNER` / Managing Director | `raka@nusantarabuildindo.co.id` | `CoveStaging2026!` | 30-second portfolio risk review & executive actions |
| **Dimas Sucipto** | `COMMERCIAL_MANAGER` | `dimas@nusantarabuildindo.co.id` | `CoveStaging2026!` | Claim progression, MC-006 blocker, Recertification |
| **Andi Wijaya** | `QS` / Senior Project QS | `andi@nusantarabuildindo.co.id` | `CoveStaging2026!` | Claim creation, Opname input, Evidence checklist |
| **Rani Prameswari** | `FINANCE_MANAGER` | `rani@nusantarabuildindo.co.id` | `CoveStaging2026!` | Invoice generation, retention deduction, cash receipts |
| **Fajar Nugroho** | `PROJECT_MANAGER` | `fajar@nusantarabuildindo.co.id` | `CoveStaging2026!` | Site progress, field blockers |

> **Note**: Staging users can also be switched instantly via the interactive **Persona Menu** in the TopBar without logging out.
