# Atlas Lab — Implementation Tasks

Master checklist of all planned features and improvements, organized by domain.

## Status Legend
- [ ] Not started
- [x] Completed
- [~] In progress

---

## 01 — Authorization & Multi-Tenancy
- [ ] Per-user data isolation (notes, jobs, documents, notifications)
- [ ] Admin can browse other users' roots
- [ ] Custom login page (bypass Keycloak UI, keep Keycloak as backend)
- [ ] Role-based visibility enforcement across all services

## 02 — Notes Enhancements
- [ ] Improved WYSIWYG editor (view mode default, edit on button click)
- [ ] Public/private folder visibility (inherited, root always private)
- [ ] File/image attachments stored via DMS, referenced in notes
- [ ] AI agent access to specific note folders as knowledge base

## 03 — DMS Enhancements
- [ ] Public folder access (unauthenticated, per-folder setting)
- [ ] Folder metadata display (created, creator, ID, shareable link)
- [ ] Enhanced sharing (presigned links with time/one-time validity)
- [ ] Subdirectory-scoped public access for skills/docs sharing

## 04 — Scheduler Enhancements
- [ ] Git executor type (clone/pull/push with SSH key support)
- [ ] n8n integration (deploy own n8n with AI module, statistics gathering)

## 05 — Notification Enhancements
- [ ] SMS channel
- [ ] Signal channel
- [ ] WhatsApp channel
- [ ] Push notifications to phone

## 06 — Claude Code Integration
- [ ] Web chat interface at /claude route
- [ ] Claude Agents SDK backend integration
- [ ] Docker sandbox for safe execution (microVM isolation)
- [ ] Image/text input support
- [ ] Tool call visibility in UI
- [ ] Chat history tracking and navigation
- [ ] Permission skip toggle with sandbox enforcement

## 07 — Custom Data Tracker
- [ ] Dynamic endpoint configuration (name, schema, validation)
- [ ] JSON data storage with auto-indexed MongoDB collections
- [ ] Public/private endpoints (public = no auth, minimal error info)
- [ ] Data visualization dashboard (table with sorting/filtering)
- [ ] Public endpoint detail page (isolated, no app chrome)

## 08 — Event Log & Audit
- [ ] Cross-service audit logging (who called what, when)
- [ ] Deployment version tracking with release notes
- [ ] GUI for browsing event log / change log

## 09 — Monitoring Dashboard
- [ ] Infrastructure links and logins (Redis, MinIO, Mongo, BullMQ, Keycloak)
- [ ] Service status and liveness checks with basic metrics
- [ ] External service monitoring (response time, availability)
  - [ ] Codebase / Codebaseg02
  - [ ] Plus4U unsafe packages
  - [ ] Nexus NPM / Harbor

## 10 — MCP Server
- [ ] MCP tools for DMS (upload/read/list files and documents)
- [ ] MCP tools for Notes (write/read/search notes)

## 11 — CI/CD & GitOps
- [ ] CI pipeline (build, typecheck, lint)
- [ ] GitOps: git push → deploy to VPS
- [ ] Production upgrade strategy (never reset, only upgrade)
- [ ] Per-service versioning and rolling updates

## 12 — Smart Home
- [ ] Tapo device integration
- [ ] Device control dashboard
