---
storyId: '1-2'
storyTitle: 'Set Up GitHub Repository Infrastructure with Terraform'
epicId: '1'
epicTitle: 'Open-Source Repository Governance & Publication'
status: 'ready-for-dev'
created: '2026-04-15'
priority: 'high'
---

# Story 1.2: Set Up GitHub Repository Infrastructure with Terraform

## Story Statement

**As a** maintainer,  
**I want** the GitHub repository infrastructure (repository settings, branch protection rules, and issue labels) managed as Terraform code,  
**So that** I can configure and maintain these settings in version control and reproduce them consistently across environments.

---

## Acceptance Criteria

### Terraform Infrastructure Setup

- ✅ GitHub infrastructure directory structure is created in `infra/github/` mirroring the lorenzogm project layout
- ✅ Terraform configuration files (`providers.tf`, `variables.tf`, `main.tf`) are copied and adapted for bmad-ui
- ✅ Configuration file `config.json` is created with appropriate values for the bmad-ui repository
- ✅ GitHub Personal Access Token is created with correct repository permissions

### Terraform Initialization & Import

- ✅ `.env` file is created with encrypted credentials using dotenvx
- ✅ `.env.keys` file is created and added to `.gitignore`
- ✅ `terraform init` succeeds and initializes the GitHub provider
- ✅ Existing repository is imported into Terraform state via `terraform import`

### Branch Protection Configuration

- ✅ Branch protection rules are configured on `main` via Terraform
- ✅ Required status checks are enforced (CI checks from Story 1.1)
- ✅ Admin bypass is enabled (maintainer can force-push)
- ✅ Auto-deletion of merged branches is configured
- ✅ Branch protection is visible and correct in GitHub repository settings

### Issue Labels & Repository Settings

- ✅ Standard issue labels are created via Terraform (bug, enhancement, documentation, good-first-issue, help-wanted, question, wontfix)
- ✅ Repository metadata is configured (description, homepage, topics, visibility)
- ✅ Security scanning is enabled (secret scanning, dependabot alerts)

### Terraform State & Verification

- ✅ `terraform plan` shows no unexpected changes after initial import and apply
- ✅ `terraform state list` shows all managed resources
- ✅ GitHub UI reflects the Terraform-managed configuration correctly
- ✅ Documentation is updated with setup and maintenance instructions

---

## Developer Context

### Why This Story Matters

GitOps for Repository Configuration: Instead of manually configuring GitHub settings through the UI (which is error-prone and doesn't scale), Terraform makes the repository configuration **reproducible, version-controlled, and auditable**. All repository settings—branch protection, labels, secrets, security policies—are defined in code.

**Key Benefits:**
1. **Infrastructure as Code**: Repository settings are version-controlled alongside application code
2. **Consistency**: Same configuration across dev, staging, and production environments
3. **Auditability**: All changes to repository settings are tracked in git history
4. **Repeatability**: Can easily set up identical repositories for new projects
5. **Automation**: Integration with CI/CD pipelines for automated infrastructure updates

### Source Template

This story **copies and adapts the Terraform infrastructure from the sibling `lorenzogm` project**:
- `../lorenzogm/infra/github/` — Source template with proven Terraform configuration
- Configuration has been tested and validated in production
- Adapted for bmad-ui repository specifics

### Current State

From **Story 1.1**, the frontend package has been reconciled:
- Biome linter is installed and configured
- TypeScript check is working  
- Build process is functional
- CI workflow is expected to be running

**Important:** The existing `bmad-ui` GitHub repository needs to be imported into Terraform state so that Terraform can manage its configuration going forward.

### Terraform Overview for This Story

**What is Terraform?**
Terraform is an Infrastructure-as-Code tool that manages cloud resources (including GitHub repositories) through declarative configuration files.

**For this story:**
1. **Copy Terraform configuration** from `../lorenzogm/infra/github/` to `infra/github/`
2. **Adapt configuration** for bmad-ui repository (name, description, branch names, etc.)
3. **Set up credentials** (GitHub Personal Access Token) with dotenvx encryption
4. **Initialize Terraform** to download providers and validate configuration
5. **Import existing repository** into Terraform state (tells Terraform to manage it)
6. **Apply configuration** to synchronize GitHub settings with Terraform definition

**What Terraform will manage:**
- Repository metadata (description, visibility, default branch)
- Branch protection rules (status checks, admin bypass, merge settings)
- Issue labels (bug, enhancement, documentation, etc.)
- Security features (secret scanning, dependabot alerts)
- GitHub Actions secrets and variables
- Repository topics/tags

---

## Source Infrastructure Reference

The `../lorenzogm/infra/github/` directory contains the proven template:

### File Structure to Copy

```
infra/github/
├── .gitignore              # Ignore .env.keys locally
├── src/
│   ├── providers.tf        # GitHub provider configuration
│   ├── variables.tf        # Input variable definitions
│   ├── main.tf             # Resource definitions (repository, labels, protection)
│   ├── .terraform/         # Provider binaries (auto-generated)
│   ├── .terraform.lock.hcl # Terraform dependency lock file
│   └── terraform.tfstate   # STATE FILE - DO NOT COMMIT (in .gitignore)
├── config.json             # Development/staging configuration
└── .env (encrypted)        # GitHub credentials (in .gitignore, encrypted with dotenvx)
```

### Key Files to Understand

1. **providers.tf** - Specifies the GitHub provider version and configuration
2. **variables.tf** - Defines all input variables (repository config, branch protections, labels, etc.)
3. **main.tf** - Resource definitions:
   - `github_repository` — Update repository settings
   - `github_branch_protection` — Define branch protection rules
   - `github_issue_label` — Create issue labels
   - `github_actions_secret` — Set GitHub Actions secrets
   - `github_actions_variable` — Set GitHub Actions variables
   - `github_repository_topics` — Set repository topics

4. **config.json** - Configuration values for bmad-ui repository:
   ```json
   {
     "ENVIRONMENT": "development",
     "repository": {
       "name": "bmad-ui",
       "description": "BMAd UI - Visual interface for agentic development workflows",
       "visibility": "public",
       "has_issues": true,
       "has_discussions": true,
       "default_branch": "main",
       "allow_squash_merge": true,
       "delete_branch_on_merge": true
     },
     "branch_protections": [
       {
         "branch_name": "main",
         "require_status_checks": true,
         "require_code_owner_reviews": false,
         "require_pull_request_reviews": false,
         "required_review_count": 0,
         "dismiss_stale_reviews": true,
         "require_linear_history": false
       }
     ],
     "labels": [
       { "name": "bug", "description": "Something isn't working", "color": "d73a4a" },
       { "name": "enhancement", "description": "New feature or request", "color": "a2eeef" },
       { "name": "documentation", "description": "Documentation improvements", "color": "0075ca" },
       { "name": "good first issue", "description": "Good for newcomers", "color": "7057ff" },
       { "name": "help wanted", "description": "Extra attention is needed", "color": "008672" },
       { "name": "question", "description": "Further information is requested", "color": "d876e3" },
       { "name": "wontfix", "description": "This will not be worked on", "color": "ffffff" }
     ],
     "topics": ["agentic", "ai", "workflow", "bmad"]
   }
   ```

---

## Tasks / Subtasks

### Phase 1: Copy and Prepare Infrastructure

- [ ] **Create `infra/` directory structure**
  - [ ] Create `infra/github/` directory
  - [ ] Create `infra/github/src/` subdirectory for Terraform files
  - [ ] Create `.gitignore` in `infra/github/` with appropriate entries

- [ ] **Copy Terraform configuration files**
  - [ ] Copy `../lorenzogm/infra/github/src/providers.tf` → `infra/github/src/providers.tf`
  - [ ] Copy `../lorenzogm/infra/github/src/variables.tf` → `infra/github/src/variables.tf`
  - [ ] Copy `../lorenzogm/infra/github/src/main.tf` → `infra/github/src/main.tf`
  - [ ] Review and understand each file (don't make changes yet)

- [ ] **Create bmad-ui-specific `config.json`**
  - [ ] Create `infra/github/src/config.json` with bmad-ui repository settings
  - [ ] Repository name: `bmad-ui`
  - [ ] Description: "BMAd UI - Visual interface for agentic development workflows"
  - [ ] Visibility: `public`
  - [ ] Default branch: `main`
  - [ ] Configure branch protection for `main` branch (require status checks, no manual reviews in Phase 1)
  - [ ] Define standard issue labels (bug, enhancement, documentation, good-first-issue, help-wanted, question, wontfix)
  - [ ] Set topics: `["agentic", "ai", "workflow", "bmad"]`

### Phase 2: Set Up Credentials & Initialize Terraform

- [ ] **Create GitHub Personal Access Token**
  - [ ] Go to https://github.com/settings/tokens/new
  - [ ] Select token type: **Personal access tokens (fine-grained)**
  - [ ] Name: `terraform-bmad-ui`
  - [ ] Expiration: 90 days (renewable)
  - [ ] Repository access: **Only select repositories** → Select "bmad-ui"
  - [ ] Permissions: Administration (read & write), Actions (read & write), Contents (read), Issues (read & write), Workflows (read & write)
  - [ ] Click **Generate token** and copy it

- [ ] **Create `.env` file with credentials**
  - [ ] Create `infra/github/.env` with:
    ```
    GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    GITHUB_OWNER=lorenzogm
    ```
  - [ ] Replace `ghp_xxx` with your actual token

- [ ] **Encrypt credentials with dotenvx**
  - [ ] In `infra/github/` directory, run: `npx dotenvx encrypt`
  - [ ] This creates `.env.keys` (decryption key) and encrypts `.env`
  - [ ] Verify `.env.keys` is in `.gitignore` (local-only, never commit)
  - [ ] Verify `.env` is now encrypted (unreadable plaintext)

- [ ] **Initialize Terraform**
  - [ ] In `infra/github/src/`, run: `dotenvx run -- terraform init`
  - [ ] This downloads the GitHub provider and validates configuration
  - [ ] Check for errors; all should say "Terraform has been successfully initialized"

### Phase 3: Import Existing Repository into State

- [ ] **Import the bmad-ui repository into Terraform state**
  - [ ] In `infra/github/src/`, run:
    ```bash
    dotenvx run -- terraform import -var-file="config.json" \
      github_repository.main bmad-ui
    ```
  - [ ] Should show: `githubrepository.main: Import successful!`
  - [ ] This tells Terraform: "This repository exists; manage it from now on"

- [ ] **Verify import succeeded**
  - [ ] Run: `dotenvx run -- terraform state list`
  - [ ] Should show resources like:
    ```
    data.github_repository.main
    github_repository.main
    ```

### Phase 4: Plan and Apply Configuration

- [ ] **Review planned changes**
  - [ ] In `infra/github/src/`, run:
    ```bash
    dotenvx run -- terraform plan -var-file="config.json"
    ```
  - [ ] Review output carefully
  - [ ] You'll likely see:
    - Repository settings being updated (description, visibility, topics, etc.)
    - Branch protection rules being created
    - Issue labels being created
  - [ ] If any changes look wrong, adjust `config.json` before applying

- [ ] **Apply Terraform configuration**
  - [ ] Run: `dotenvx run -- terraform apply -var-file="config.json"`
  - [ ] Review the prompt and type `yes` to confirm
  - [ ] Watch for any errors during apply
  - [ ] Should finish with "Apply complete!"

### Phase 5: Verify Configuration in GitHub

- [ ] **Verify repository settings in GitHub UI**
  - [ ] Go to https://github.com/lorenzogm/bmad-ui/settings
  - [ ] Check:
    - Description matches config (BMAd UI - Visual interface...)
    - Visibility is public
    - Default branch is `main`
    - Topics are set correctly

- [ ] **Verify branch protection rule on `main`**
  - [ ] Go to Settings → Branches → Branch protection rules
  - [ ] Verify rule on `main` exists with:
    - Status checks required (should show CI job once available)
    - Auto-delete head branches enabled
    - Admins can push (bypass enabled)
    - No manual review requirements (Phase 1 scope)

- [ ] **Verify issue labels**
  - [ ] Go to Issues → Labels
  - [ ] Verify all 7 standard labels exist:
    - `bug` (red), `enhancement` (cyan), `documentation` (blue)
    - `good first issue` (purple), `help wanted` (green)
    - `question` (pink), `wontfix` (light gray)
  - [ ] Each has correct color and description

- [ ] **Verify security features**
  - [ ] Go to Settings → Code security and analysis
  - [ ] Verify enabled:
    - Secret scanning
    - Push protection
    - Dependabot alerts
    - Dependabot security updates

### Phase 6: Commit and Document

- [ ] **Commit Terraform infrastructure**
  - [ ] Stage files:
    ```bash
    git add infra/github/src/*.tf infra/github/src/config.json infra/github/.gitignore
    ```
  - [ ] Commit with message:
    ```
    feat: add Terraform GitHub infrastructure management
    
    - Copy GitHub provider configuration from lorenzogm template
    - Configure repository settings, branch protection, and labels via Terraform
    - Import existing bmad-ui repository into managed state
    - Enable security scanning and dependabot alerts
    
    Fixes: Story 1-2
    ```

- [ ] **Do NOT commit sensitive files**
  - [ ] Verify `.env` and `.env.keys` are NOT in the commit
  - [ ] Verify only `.gitignore` (not actual files) are in git

- [ ] **Create README or update documentation**
  - [ ] Copy `../lorenzogm/infra/github/README.md` to `infra/github/README.md` for reference
  - [ ] Or create `infra/github/SETUP.md` with bmad-ui-specific instructions
  - [ ] Document:
    - How to set up credentials locally
    - How to run terraform plan/apply
    - How to maintain branch protection rules
    - How to update repository configuration

---

## Dev Notes

### Important Implementation Details

#### 1. **Source of Truth**

The `../lorenzogm/infra/github/` directory is the proven template. Use it as reference, but adapt values for bmad-ui.

**Do copy:**
- `providers.tf` (unchanged)
- `variables.tf` (unchanged)
- `main.tf` (unchanged)
- Structure and organization

**Do customize:**
- `config.json` (repository-specific values)
- `.env` (your own GitHub token and owner)
- README/documentation (bmad-ui-specific)

#### 2. **Credentials & Security**

**GitHub Token:**
- Use fine-grained token (not classic tokens)
- Scope to single repository ("bmad-ui" only)
- Minimal permissions: Administration, Actions, Contents, Issues, Workflows
- Expire in 90 days (rotate regularly)

**dotenvx Encryption:**
- Encrypts `.env` file so plaintext token is not stored
- `.env.keys` decryption key is local-only (in `.gitignore`)
- On CI: Store `.env.keys` in secret; `.env` can be committed encrypted
- For local development: Store `.env.keys` in your home directory or machine keychain

#### 3. **State File Management**

The `.terraform/` directory contains provider binaries and Terraform state.

**.gitignore correctly excludes:**
- `.terraform/` — Provider binaries (auto-generated, machine-specific)
- `.terraform.lock.hcl` — Lock file (should be committed in production projects)
- `terraform.tfstate*` — State files (NEVER commit; local-only)
- `.env.keys` — Decryption key (NEVER commit; local-only)

For Phase 1, this is fine. In Phase 2 (Vercel deployment), you may want to set up remote state (Terraform Cloud or S3).

#### 4. **Branch Protection Scope for Phase 1**

The `config.json` configures branch protection with **CI gates only**:
- `require_status_checks: true` — Require CI to pass
- `require_pull_request_reviews: false` — No manual reviews (Phase 1)
- `require_code_owner_reviews: false` — No code owner rules (Phase 1)
- `require_linear_history: false` — Allow merge commits in Phase 1
- `dismiss_stale_reviews: true` — Good practice (though no reviews in Phase 1)

This matches Story 1.2 acceptance criteria: **CI gates only, no manual approval gates**.

#### 5. **Importing Existing Repository**

The `terraform import` command tells Terraform about a resource that already exists:

```bash
terraform import github_repository.main bmad-ui
```

This:
1. Reads the current state of `bmad-ui` from GitHub API
2. Stores it in `terraform.tfstate` local file
3. From then on, Terraform manages this repository

**Important:** Import only needs to be done once. Future `terraform plan/apply` commands will update the repository to match `config.json`.

#### 6. **Plan vs. Apply**

Always run `terraform plan` first to review changes:

```bash
# Review what Terraform WILL do (read-only)
dotenvx run -- terraform plan -var-file="config.json"

# Actually apply the changes
dotenvx run -- terraform apply -var-file="config.json"
```

The plan shows:
- `+` resource to be created
- `~` resource to be updated
- `-` resource to be deleted

Review carefully before applying. In GitHub, these changes are immediately visible (cannot be rolled back without running Terraform again).

#### 7. **Common Issues & Solutions**

**"Repository not found"**
- Token doesn't have permission for this repository
- Repository name is wrong
- GITHUB_OWNER is wrong

**"Authentication failed"**
- Token is expired or revoked
- Token is not fine-grained (use new token type)
- dotenvx not loading `.env` correctly

**"State conflicts"**
- If Terraform detects drift (manual GitHub changes), plan will show updates
- You can either:
  - Apply Terraform changes to override manual changes (recommended)
  - Manually update `config.json` to match GitHub, then plan again

**"terraform init fails"**
- Check internet connection (needs to download provider)
- Verify GitHub provider version is available for your OS/architecture

### File Structure Confirmation

After completing this story, you should have:

```
infra/
└── github/
    ├── .gitignore
    ├── README.md (or SETUP.md)
    ├── src/
    │   ├── providers.tf
    │   ├── variables.tf
    │   ├── main.tf
    │   ├── config.json
    │   ├── .terraform/          # Auto-generated
    │   ├── .terraform.lock.hcl   # Auto-generated
    │   └── terraform.tfstate*    # Local-only (not committed)
    ├── .env (encrypted)          # Local-only (not committed)
    └── .env.keys (decryption)    # Local-only (not committed)
```

### Previous Story Context

From **Story 1.1 (Reconcile Frontend Baseline)**:
- Biome linter is installed and passing
- TypeScript checks pass
- Build succeeds
- CI workflow may be defined (if Story 1.1 includes GitHub Actions setup)

Story 1.2 **depends on at least basic CI setup** for branch protection status checks. If CI workflow is not yet defined, the branch protection rule will be created but the status check will be selectable once a CI workflow runs.

---

## Architecture Compliance

### Infrastructure as Code (IaC) Requirement

From **Architecture Decision Document**:

> "Terraform 1.14.x is the infrastructure provisioning standard for GitHub and Vercel resources"

**Story 1.2 implements this** by:
1. Using Terraform (standard version managed by copy from lorenzogm)
2. Managing GitHub repository configuration as declarative code
3. Enabling reproducible, version-controlled infrastructure
4. Establishing pattern for Vercel infrastructure (Story 2.2)

### Security Requirements

From **Epic 1 Requirements**:

| Requirement | How Story 1.2 Addresses It |
|---|---|
| NFR7: "Repository branch protection enforces required checks before merge" | ✅ Configure via Terraform for durability |
| Security: Version-controlled repository settings | ✅ All settings in `config.json` |
| Security: Rotation of credentials | ✅ Document token rotation process |
| Security: Secret scanning enabled | ✅ Terraform enables secret scanning and dependabot |

### Consistency with lorenzogm Project

This story directly references and reuses proven infrastructure from the `lorenzogm` project, ensuring:
- Consistent Terraform patterns across projects
- Proven provider configuration (GitHub 6.2.1)
- Tested variable structures and resource definitions
- Established security and state management practices

---

## Verification Checklist

Before marking this story **done**, verify:

- [ ] `infra/github/` directory structure exists with all required files
- [ ] `providers.tf`, `variables.tf`, `main.tf` copied from lorenzogm template
- [ ] `config.json` created with bmad-ui-specific values
- [ ] `.env` file created and encrypted with dotenvx
- [ ] `.env.keys` file exists and is in `.gitignore`
- [ ] `terraform init` completes successfully
- [ ] Repository imported into Terraform state via `terraform import`
- [ ] `terraform state list` shows managed resources
- [ ] `terraform plan` output reviewed and understood
- [ ] `terraform apply` completes successfully
- [ ] GitHub repository settings match `config.json` values
- [ ] Branch protection rule exists on `main` with correct settings
- [ ] All 7 standard issue labels created in GitHub
- [ ] Security features enabled (secret scanning, dependabot)
- [ ] Infrastructure files committed to git (excluding `.env` and `.env.keys`)
- [ ] Documentation created or copied (README/SETUP.md in `infra/github/`)
- [ ] Git commit includes all Terraform files and configuration

---

## Session Context

**Story ID:** 1-2  
**Story Key:** `1-2-setup-github-infrastructure-with-terraform`  
**Epic:** Epic 1 - Open-Source Repository Governance & Publication  
**Effort:** Medium (2-3 hours including credential setup, testing, and verification)  
**Blocker Status:** Depends on GitHub repository being accessible and user having permissions to create Personal Access Tokens  
**Next Story:** 1-3 (Define Issue Labels for Triage) — Labels will be created by Terraform in this story  
**Related Stories:** Story 2.1 (Terraform GitHub Infrastructure) — Provides foundation for Infrastructure as Code pattern

---

## References

- **Epics Document:** [Planning Artifacts](../planning-artifacts/epics.md) — Epic 1, Story 1.2
- **Source Template:** `../lorenzogm/infra/github/` — Proven Terraform configuration
- **Architecture:** [Architecture Decision Document](../planning-artifacts/architecture.md) — "Terraform 1.14.x is the infrastructure provisioning standard"
- **Project Context:** [Project Context Rules](../project-context.md) — Tech stack and standards
- **Terraform GitHub Provider:** https://registry.terraform.io/providers/integrations/github/latest/docs
- **dotenvx Documentation:** https://dotenvx.sh/
- **GitHub Personal Access Tokens:** https://github.com/settings/tokens
- **GitHub Terraform Provider Changelog:** https://registry.terraform.io/providers/integrations/github/6.2.1/docs

---

**Status:** ready-for-dev  
**Created:** 2026-04-15  
**Last Updated:** 2026-04-15
