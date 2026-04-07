# Cattle Action: Project Overview & Product Development Requirements

**Project Name**: Cattle Action / Con Bò Cười  
**Version**: 1.0 (Phase 1)  
**Last Updated**: 2026-04-07  
**Status**: MVP Complete  

## Executive Summary

**Cattle Action** is a precision livestock farming platform combining real-time computer vision, AI behavior detection, and farm management. The system monitors cattle via cameras, detects behavioral anomalies (abnormal lying, collision, reduced movement), generates alerts, and stores data for AI training. Phase 1 supports single-farm operation with user/admin roles. Future phases enable multi-tenant SaaS, advanced RBAC, and visual re-identification.

---

## Problem Statement

### Five Core Pain Points

1. **Manual Monitoring Inefficiency** - Farm staff rely on manual observation 24/7, missing early health indicators due to fatigue or attention gaps.

2. **Delayed Anomaly Detection** - Cattle abnormal behaviors (prolonged lying, collision injuries, reduced movement) often go unnoticed until health deteriorates.

3. **No Standardized Data Collection** - Inconsistent record-keeping limits ability to train AI models, analyze herd trends, or provide data to veterinarians.

4. **Limited Scalability** - As farms grow, manual monitoring becomes impossible without proportional staff increase.

5. **Lack of Integration Framework** - No centralized platform to manage multiple farms, users, or regulatory compliance.

---

## Vision & Mission

### Vision

Transform livestock farming through AI-powered real-time monitoring, enabling farmers to detect health issues early, improve animal welfare, and operate at scale.

### Mission

Provide a unified platform that automatically monitors cattle behavior, alerts to anomalies, collects training data, and scales from single farms to multi-farm networks with role-based governance.

---

## Strategic Goals

1. Reduce cattle health incident response time from hours to minutes
2. Eliminate dependency on 24/7 manual observation
3. Build dataset for continuous AI model improvement
4. Enable farms to grow without proportional monitoring staff
5. Support future regulatory compliance and veterinary oversight

---

## Functional Objectives

1. Detect cattle with ≥95% accuracy in typical farm lighting
2. Classify 6 core behaviors: standing, lying, eating, drinking, walking, abnormal
3. Generate alerts within 60 seconds of abnormal detection
4. Store unlimited historical images with searchable metadata
5. Support CSV/JSON export for external analysis
6. Enable user management with role-based permissions
7. Support multi-tenant architecture (farm isolation)
8. Maintain ≤2s image upload-to-result latency over LAN
9. Achieve 99.9% uptime on VPS deployment

---

## Role Hierarchy

| Role | Scope | Permissions | Future Expansion |
|------|-------|-------------|-----------------|
| **Non User** | Public | View landing page, blog, demo, sign up | Limited read-only in Phase 2 |
| **User** | Farm staff | Upload images, view gallery, export, alerts | Limited to assigned farm |
| **Admin** | Farm manager | Create users, configure AI, farm settings | Farm-level, no cross-farm |
| **Vet** | (Phase 2) | Read-only: reports, alerts, statistics | Regional oversight |
| **SuperAdmin** | (Phase 2) | Platform-wide: farms, users, tenants, billing | Operator-level |

---

## Feature Scope

### Phase 1: Core (Planned)

**Implemented**:

- User authentication (register, login, logout, sessions)
- Image upload (drag-drop + form)
- Webcam capture with burst mode
- Gallery with search/filter (cow_id, behavior, barn_area)
- Image delete with cleanup
- AI detection (YOLOv8) → behavior classification → annotation
- Data export (CSV, JSON)
- Blog posts, comments, likes
- Admin user management
- Admin AI configuration
- Dashboard with stats

**Out of Scope (Phase 1)**:

- Multi-tenant enforcement
- Vet/compliance roles
- Real-time alerts (email/SMS/push)
- Advanced RBAC
- Visual re-identification
- Weight/body condition estimation

### Phase 2: Multi-Tenant & Advanced (Planned 🔄)

- Farm-based data isolation
- 5-role RBAC
- Real-time alert system
- Audit logging
- Billing integration
- API versioning

### Phase 3: Intelligent (Future 🔴)

- Visual re-identification
- Weight estimation
- Disease prediction engine
- Multi-species support
- Mobile app (Flet-based)
- SaaS dashboard

---

## Feature Status Table

| Feature | Phase | Status | Notes |
|---------|-------|--------|-------|
| User authentication | 1 | 🟡 | Session-based, bcrypt |
| Image upload | 1 | 🟡 | Multer, dated folders |
| Webcam capture | 1 | 🟡 | getUserMedia, burst |
| Gallery & search | 1 | 🟡 | Filter by cow_id, behavior, area |
| AI detection | 1 | 🟡 | YOLOv8 PT, conf + IoU filtering |
| 6 behaviors | 1 | 🟡 | standing, lying, eating, drinking, walking, abnormal |
| Image annotation | 1 | 🟡 | OpenCV bounding boxes |
| Data export | 1 | 🟡 | CSV + JSON |
| Blog & comments | 1 | 🟡 | CRUD, likes, images |
| Admin panel | 1 | 🟡 | User mgmt, AI config, stats |
| Farm isolation | 2 | 🟡 | Tables have farm_id, not enforced |
| 5-role RBAC | 2 | 🟡 | Currently: user/admin only |
| Real-time alerts | 2 | 🟡 | Infrastructure ready |
| Visual re-ID | 3 | 🔴 | Not started |

---

## Key Design Decisions

### 1. Monolithic Backend + Separate AI Service

**Rationale**: Simpler VPS deployment, clear separation of concerns, AI scales independently.

### 2. Server-Side Sessions

**Rationale**: Stateful sessions allow instant logout, revocation, audit logging.

### 3. Relative Image URLs

**Rationale**: Supports multiple hosts (localhost, VPS IP, domain) without hardcoding.

### 4. Dated Folder Structure

**Rationale**: Prevents directory explosion, enables efficient date-range cleanup.

### 5. Edge AI (Local YOLOv8)

**Rationale**: No external API dependency, low latency, offline capable, no per-inference billing.

---

## Acceptance Criteria

### Functional

- Image upload → detection → annotation within 20 seconds
- Gallery can filter 10,000+ images in <2 seconds
- Export 1000 rows to CSV in <5 seconds
- User/admin roles strictly enforce permissions
- AI returns results with confidence scores
- Blog supports image attachments and comments

### Non-Functional

- All code files <200 LOC
- 95% test coverage for critical paths
- Zero hardcoded credentials
- Database schema supports farm_id
- PM2 auto-restart on crash
- Nginx reverse proxy handles CORS
- SSL certificate auto-renews

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Image detection accuracy | ≥95% | 92% (tuning needed) |
| Response time | <500ms | 380ms (good) |
| Uptime (VPS) | 99.9% | 99.5% (good) |
| Test coverage | ≥90% | 65% (in progress) |
| Doc coverage | 100% endpoints | 85% (in progress) |
| User setup time | <10 min | 15 min (streamline) |

---

## Dependencies

### External

- PostgreSQL 12+ (accessible, firewall 5432)
- YOLOv8 model file (`bounding_cattle_v1_22es.pt`)
- Node.js 16+ (LTS recommended)
- Nginx (reverse proxy)
- Let's Encrypt (SSL for webcam)

### Constraints

- No third-party payments (Phase 1)
- No external email/SMS (Phase 2)
- Single database instance (Phase 3: failover)
- Synchronous image processing (Phase 2: async jobs)
- Farm isolation by convention (Phase 2: database-enforced)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| AI model accuracy degrades in low light | Medium | High | Diverse training data, quarterly retraining |
| Database grows >500GB | Low | High | Archive old images to cold storage (Phase 2) |
| VPS connectivity loss | Low | Critical | Failover VPS, monitoring alerts |
| Unauthorized data access | Medium | Critical | Enforce farm_id in Phase 2, audit logs |
| Webcam not working (browser policy) | High | Medium | Document HTTPS requirement |
| Upload spike (100+ concurrent) | Low | Medium | Async job queue, rate limiting (Phase 2) |

---

**Last Updated**: 2026-04-07  
**Version**: 1.0 (Phase 1)
