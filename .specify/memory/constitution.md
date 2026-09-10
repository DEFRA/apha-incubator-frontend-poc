<!--
Sync Impact Report
- Version change: template/undefined -> 1.0.0
- Modified principles: none; populated all five scaffold principles
- Added sections: Additional Constraints; Development Workflow
- Removed sections: none
- Follow-up TODOs: RATIFICATION_DATE requires confirmation of the original adoption date
-->

# APHA Incubator Frontend POC Constitution

## Core Principles

### I. Government-Service User Focus

The service MUST provide clear, accessible, and consistent journeys for its intended users.
User-facing pages MUST use GOV.UK Frontend and established Defra design patterns unless a
documented exception is approved. Content and interaction decisions MUST be traceable to a
user need or service requirement. This keeps the proof of concept aligned with production
government-service expectations.

### II. Secure-by-Default Delivery

All application code MUST protect user data and service boundaries by default. Secrets MUST
remain outside source control, configuration MUST be validated at startup, and external
requests MUST use approved clients and proxy configuration where required. Security audits,
secure headers, and dependency controls MUST remain part of the delivery workflow. This
reduces avoidable risk before the service is deployed or reused.

### III. Testable and Observable Changes

Every behavioural change MUST include automated tests at the narrowest appropriate level.
Tests MUST cover success paths, validation failures, and error handling for changed behaviour.
Application events and operational failures MUST use structured logs and existing metrics or
tracing integrations where those signals are needed to diagnose the service. This makes
regressions detectable and production behaviour diagnosable.

### IV. Small, Composable Design

Features MUST use the simplest design that satisfies the requirement and MUST reuse existing
helpers, components, configuration, and integrations before introducing new abstractions.
Application responsibilities MUST remain separated between routes, services, configuration,
and presentation. Any added complexity or duplication MUST have a documented reason. This
keeps the incubator easy to change and limits prototype-only debt.

### V. Reproducible Quality Gates

Changes MUST pass the repository's formatting, JavaScript linting, stylesheet linting,
security-audit, and relevant test checks before merge. Builds and tests MUST use the supported
Node.js version and documented package scripts. CI and local checks MUST produce repeatable
results without relying on untracked machine state. This ensures that reviewed code behaves
consistently across developer and delivery environments.

## Additional Constraints

The service MUST remain compatible with the supported Node.js engine and the repository's
Hapi, Vite, GOV.UK Frontend, caching, logging, metrics, and tracing conventions. Production
deployments MUST use a shared cache when session state or cache consistency requires it;
in-memory cache is for local development only. Configuration changes MUST document required
environment variables and safe defaults. The project MUST retain its stated open-source
licence and follow applicable Defra and UK government security and accessibility policies.

## Development Workflow

Each change MUST have a clear requirement, a focused implementation, and an appropriate
review. Pull requests MUST describe user impact, operational impact, configuration changes,
and test evidence. Reviewers MUST check compliance with this constitution and MUST reject
unjustified complexity, untested behaviour, known security regressions, or accessibility
regressions. A change that cannot meet a quality gate MUST record the reason, risk, owner,
and time-bound follow-up before approval.

## Governance

This constitution is the authoritative project governance document. Where another practice
conflicts with it, the conflict MUST be resolved in favour of this constitution or recorded
as an approved amendment.

Amendments MUST be proposed in a reviewed pull request that states the motivation, affected
principles, compatibility impact, migration needs, and compliance impact. Approval MUST come
from the project maintainers. After approval, the amended document MUST update the sync impact
report, version, and last-amended date. Relevant templates, plans, and tasks read this
constitution at runtime and MUST apply its current rules.

Versioning follows semantic versioning for governance: MAJOR for backward-incompatible
removals or redefinitions, MINOR for new principles or materially expanded obligations, and
PATCH for clarifications or non-semantic wording changes. Compliance MUST be reviewed during
each pull request and at the start of any new feature specification. Exceptions MUST be
explicit, risk-assessed, approved by maintainers, and given an expiry or review date.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-09-09
