# GitHub Infrastructure (Terraform)

Terraform configuration that manages the `bmad-ui` GitHub repository settings as code — branch protection, issue labels, repository metadata, and security features.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| [Terraform](https://developer.hashicorp.com/terraform/install) | ≥ 1.14 | `brew install terraform` |
| [dotenvx](https://dotenvx.com/) | latest | `npm install -g @dotenvx/dotenvx` |
| GitHub PAT | — | See [Creating a Token](#creating-a-github-personal-access-token) |

---

## Directory Structure

```
infra/github/
├── .gitignore          # Excludes .env, .env.keys, state files
├── README.md           # This file
└── src/
    ├── providers.tf    # GitHub provider configuration (Terraform ≥ 1.14)
    ├── variables.tf    # Input variable type definitions
    ├── main.tf         # Resource definitions
    └── config.json     # bmad-ui-specific configuration values
```

**Files NOT committed (gitignored):**

| File | Reason |
|---|---|
| `.env` | Plain or encrypted credentials — never commit |
| `.env.keys` | Decryption key — never commit |
| `src/.terraform/` | Downloaded provider binaries — machine-specific |
| `src/terraform.tfstate*` | Terraform state — contains sensitive data |

---

## First-Time Setup

### 1. Creating a GitHub Personal Access Token

1. Go to <https://github.com/settings/tokens?type=beta>
2. Click **Generate new token (fine-grained)**
3. Set **Token name**: `terraform-bmad-ui`
4. Set **Expiration**: 90 days (add a calendar reminder to rotate)
5. Set **Repository access**: Only select repositories → `bmad-ui`
6. Grant these **Repository permissions**:
   - Administration: **Read and write**
   - Actions: **Read and write**
   - Contents: **Read-only**
   - Issues: **Read and write**
   - Workflows: **Read and write**
7. Click **Generate token** and copy the value immediately

### 2. Create and encrypt credentials

```bash
cd infra/github

# Create plaintext .env (replace with your actual token)
cat > .env <<'EOF'
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=lorenzogm
EOF

# Encrypt in-place with dotenvx (generates .env.keys beside it)
npx dotenvx encrypt

# Store .env.keys somewhere safe (password manager, 1Password, etc.)
# NEVER commit .env.keys
```

### 3. Initialize Terraform

```bash
cd infra/github/src

dotenvx run -- terraform init
# Expected: "Terraform has been successfully initialized!"
```

### 4. Import existing repository into Terraform state

The `bmad-ui` repository already exists on GitHub. Tell Terraform to manage it:

```bash
cd infra/github/src

dotenvx run -- terraform import \
  -var-file="../config.json" \
  github_repository.main bmad-ui
# Expected: "github_repository.main: Import successful!"
```

Verify the state was written:

```bash
dotenvx run -- terraform state list
# Expected output:
# github_repository.main
```

### 5. Review planned changes

```bash
dotenvx run -- terraform plan -var-file="../config.json"
```

Review the output carefully:
- `+` = resource will be **created** (e.g. labels, branch protection)
- `~` = resource will be **updated** (e.g. repository description sync)
- `-` = resource will be **deleted** ← investigate before applying

### 6. Apply configuration

```bash
dotenvx run -- terraform apply -var-file="../config.json"
# Review plan one more time, then type: yes
```

---

## Day-to-Day Operations

### Adding a new issue label

Edit `src/config.json`, add to the `labels` array:

```json
{ "name": "my-label", "description": "My label description", "color": "ff6b6b" }
```

Then run plan + apply:

```bash
cd infra/github/src
dotenvx run -- terraform plan  -var-file="../config.json"
dotenvx run -- terraform apply -var-file="../config.json"
```

### Updating repository metadata

Edit values in the `repository` object inside `src/config.json`, then plan + apply.

### Updating branch protection rules

Edit the `branch_protections` array in `src/config.json`.

**Important:** `required_status_check_contexts` must be set explicitly — it is **not** auto-detected by Terraform. You must provide the exact context string (format: `<workflow name> / <job name>`, e.g., `bmad-ui-ci / Validate`) that GitHub registers after the CI workflow runs at least once.

To discover the context string:
1. Ensure the CI workflow has run at least once on a PR or via `workflow_dispatch`
2. Go to GitHub → Settings → Branches → Edit `main` protection rule → "Status checks" search
3. The registered context will appear — copy it exactly into `required_status_check_contexts`

> **Note on infra scope:** The `infra-deploy` job in `deploy.yml` manages **Vercel infrastructure only** (`infra/vercel/`). GitHub repository settings (branch protection, labels, etc.) are managed by **local `terraform apply`** from `infra/github/src/`. Do not expect GitHub infra changes to apply automatically via the deploy workflow.

---

## Rotating the GitHub Token

1. Go to <https://github.com/settings/tokens> and generate a new token
2. Update `infra/github/.env` with the new token value
3. Re-encrypt: `npx dotenvx encrypt` (from `infra/github/`)
4. Revoke the old token in GitHub settings

---

## Troubleshooting

| Error | Likely Cause | Fix |
|---|---|---|
| `Repository not found` | Token lacks admin permission or wrong repo name | Verify PAT permissions and `GITHUB_OWNER` value |
| `Authentication failed` | Expired or revoked token | Rotate token (see above) |
| `State conflicts` | Repository settings drifted from config | Run `plan` and review; apply to reconcile |
| `terraform init` fails | No internet / wrong architecture | Check connectivity; re-run on target machine |
| `Forbidden (403)` | Token scope too narrow | Ensure Administration read/write is granted |

---

## References

- [GitHub Terraform Provider docs](https://registry.terraform.io/providers/integrations/github/latest/docs)
- [dotenvx documentation](https://dotenvx.com/)
- [GitHub fine-grained PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)
- [Story 1-2: Set Up GitHub Repository Infrastructure with Terraform](../../_bmad-output/implementation-artifacts/1-2-setup-github-infrastructure-with-terraform.md)
