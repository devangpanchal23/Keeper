# Contributing to Keeper Open-Source Edition

Thank you for your interest in contributing to Keeper! Keeper is a community-driven, AI-powered universal content capture, bookmarking, and knowledge management platform.

---

## 1. Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, constructive, and collaborative in all discussions and pull requests.

---

## 2. Getting Started

### Prerequisites
- **Node.js**: `v20+` (v22 recommended)
- **Package Manager**: `npm`
- **Git**

### Installation
```bash
# Clone the repository
git clone https://github.com/Devang/Keeper.git
cd Keeper

# Switch to the open-source branch
git checkout open_source_keeper

# Copy environment variables
cp .env.example .env.local

# Install dependencies
npm ci

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## 3. Branching & Edition Architecture

Keeper maintains two editions:
1. `main`: Commercial Paid Edition (private infrastructure and paid billing integrations).
2. `open_source_keeper`: Free Open-Source Edition (100% free, self-hostable, no paywalls or commercial restrictions).

> [!IMPORTANT]
> All open-source contributions must be targeted against and branched from `open_source_keeper`. **Never submit PRs against or modify `main`.**

---

## 4. Architectural Invariants

Every contribution must honor the core architectural invariants:
1. **Source Data Immutability**: Authoritative metadata imported from official exports (Meta JSON/ZIP, YouTube CSV) must never be overwritten by weaker remote guest scraping or AI-derived fields. All updates to saved items must route through `ContentService.safeMerge()`.
2. **Canonical URL Immutability**: Canonical URLs must maintain stable identity. Only query parameter stripping (UTM/tracking params) is permitted.
3. **Authentic Thumbnails Only**: Stock photos (Unsplash, Matrix code wallpapers) are permanently banned. If authentic media is unavailable, Keeper renders the vector placeholder card.
4. **Tenant Isolation**: Multi-tenant data separation is strictly enforced. Cross-user data mutation or access is prohibited.
5. **No Artificial Quotas**: Features in the open-source edition must remain unrestricted. Do not add paid paywalls or import limits.

---

## 5. Development & Quality Gates

Before submitting a Pull Request, you must verify that all four mandatory validation gates pass:

```bash
# 1. TypeScript Strict Type Check (must exit with 0 errors)
npm run type-check

# 2. Automated Regression Test Suite (all 284+ tests must pass)
npm test

# 3. ESLint Quality Check (0 errors)
npm run lint

# 4. 60:30:10 Design Palette Audit (100% compliance)
npm run audit:design

# 5. Production Next.js Turbopack Build (clean compile)
npm run build
```

---

## 6. Submitting a Pull Request

1. Fork the repository and create your branch from `open_source_keeper`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, descriptive commit messages.
3. Push to your fork and submit a Pull Request against `open_source_keeper`.
4. Provide a thorough summary of the problem, root cause, implementation details, and verification output in your PR description.

