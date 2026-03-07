# Selfware Repository Review Summary

**Review Date:** 2026-03-06  
**Scope:** ~/selfware (main Rust project) + ~/selfware.design (website)  
**Analysts:** Multi-agent code review team

---

## Executive Summary

| Area | Grade | P0 Issues | P1 Issues | P2 Issues |
|------|-------|-----------|-----------|-----------|
| Core Code | B+ | 4 | 9 | 13 |
| Security | B+ | 3 | 3 | 4 |
| UX/TUI | B | 3 | 5 | 4 |
| Testing/CI | C+ | 5 | 10 | 8 |
| Documentation | B- | 3 | 4 | 9 |
| Website | C+ | 3 | 7 | 12 |
| **TOTAL** | **B** | **21** | **38** | **50** |

---

## 🚨 CRITICAL (P0) ISSUES - Fix Immediately

### 1. Security Vulnerabilities

| Issue | File | Severity | Fix |
|-------|------|----------|-----|
| **FIM Instruction Injection** | `src/tools/fim.rs:94-100` | 🔴 Critical | Sanitize instructions before prompt construction |
| **TOCTOU Race Condition** | `src/safety/path_validator.rs:121-153` | 🔴 High | Use O_NOFOLLOW consistently, operate on file descriptors |
| **Test Mode Path Bypass** | `src/tools/file.rs:485-494` | 🔴 High | Remove absolute path bypass in test mode |
| **YOLO Mode Destructive Bypass** | `src/safety/yolo.rs:316-324` | 🔴 High | Use same dangerous patterns as checker.rs |

### 2. Async/Blocking Issues

| Issue | File | Impact | Fix |
|-------|------|--------|-----|
| **Blocking stdin in async** | `src/agent/execution.rs:437-495` | Deadlock risk | Use `tokio::task::spawn_blocking` |
| **std::sync in async context** | `src/cognitive/self_improvement.rs:13` | Thread starvation | Migrate to `tokio::sync` |
| **Sync file operations** | `src/tools/file.rs:196-200` | Event loop blocking | Use async fs operations |

### 3. Website Security

| Issue | File | Fix |
|-------|------|-----|
| **No rate limiting on subscribe** | `server.js:65-94` | Add IP-based rate limiting (5 req/hour) |
| **Sync file operations** | `server.js:79,85,135,143` | Use `fs.promises` async API |
| **No input sanitization** | `server.js:84` | Sanitize email: `email.toLowerCase().trim().slice(0,254)` |

### 4. CI/CD Critical Gaps

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| **Integration tests not run** | `.github/workflows/ci.yml` | Untested critical paths | Add `--features integration` to CI |
| **Coverage threshold mismatch** | CI (78%) vs tarpaulin.toml (80%) | Confusion | Standardize on 80% |
| **cargo-deny not in CI** | `deny.toml` exists but unused | Vulnerable dependencies | Add `cargo deny check` job |
| **No fuzzing in CI** | `fuzz/` exists | Security gaps | Add fuzzing job (weekly) |

### 5. Documentation-Code Sync

| Issue | File | Fix |
|-------|------|-----|
| **Non-existent command** | `system_tests/long_running/README.md:132` | Remove `selfware dashboard` refs |
| **Missing feature flags** | `docs/QWEN_CODE_CLI_UI.md:51` | Add `--features tui` to examples |
| **Inconsistent checkpoint intervals** | `docs/LONG_RUNNING_TEST_PLAN.md` | Standardize on 15 min |

---

## 🔶 IMPORTANT (P1) ISSUES - Fix This Sprint

### Code Quality

1. **Split cli.rs (50KB/1562 lines)** into modules:
   ```
   src/cli/
     ├── mod.rs
     ├── commands.rs
     ├── init_wizard.rs
     ├── handlers.rs
     └── demo.rs
   ```

2. **Consolidate duplicate memory systems**:
   - `cognitive/memory_hierarchy.rs`
   - `cognitive/state.rs`
   - `cognitive/episodic.rs`
   → Single unified memory architecture

3. **Consolidate token counting** (3 implementations → 1):
   - Keep `token_count.rs` as source of truth
   - Remove duplicates from `memory.rs`, `tokens.rs`

4. **Standardize error handling**:
   - Use `SelfwareError` hierarchy consistently
   - Remove mixed `anyhow::bail!` usage

### Security (P1)

5. **Secret Scanner ReDoS** - Add regex timeout
6. **Sandbox disable token** - Generate at runtime, not hardcoded
7. **Backup file permissions** - Set 0600 on backups

### UX/Performance (P1)

8. **TUI FPS throttling** - Make configurable (currently hardcoded 30 FPS)
9. **Garden visualization** - Add incremental scanning with mtime caching
10. **Animation cleanup** - Run cleanup even when paused
11. **Evolution daemon** - Add TUI integration for progress feedback

### Testing (P1)

12. **Pre-commit hook too heavy** - Split fast/slow tests
13. **Ignored tests** - Add weekly CI job to run them
14. **System tests** - Add to nightly CI
15. **Add benchmarks** for: agent loop, tool execution, memory ops

### Website (P1)

16. **Add HTTPS redirect** logic
17. **Add CSP nonces** for inline scripts
18. **Add React Error Boundaries** - Prevent full app crash
19. **Add GitHub API fallback** for rate limiting
20. **Implement log rotation** for analytics.log

---

## 🟢 NICE-TO-HAVE (P2) - Backlog

### Code Improvements

- [ ] Add module-level READMEs
- [ ] Create ADR (Architecture Decision Records) directory
- [ ] Migrate to Rust 2024 edition
- [ ] Remove async_trait (native async traits stable in 1.75+)
- [ ] Centralize magic numbers in `config/defaults.rs`
- [ ] Split files >2000 lines

### Features

- [ ] Carbon tracker UI exposure (`selfware status --carbon`)
- [ ] Cache integration (currently feature-gated but unused)
- [ ] Theme system - expose all 10 themes (currently only 4)
- [ ] Service worker for offline capability
- [ ] PWA support

### Documentation

- [ ] Auto-generate tool documentation from schemas
- [ ] Add link checking to CI
- [ ] Add Mermaid diagrams to architecture docs
- [ ] Create quick reference cards
- [ ] Add dark/light mode toggle to website

---

## 📋 Action Plan by Priority

### Week 1: Security & Stability

```bash
# 1. Fix security vulnerabilities
cd ~/selfware

# FIM injection fix - add sanitization
# TOCTOU fix - use O_NOFOLLOW consistently  
# Test mode bypass - remove absolute path check

# 2. Fix async blocking issues
# Wrap blocking I/O in spawn_blocking
# Replace std::sync with tokio::sync

# 3. Fix website security
cd ~/selfware.design
# Add rate limiting to server.js
# Convert sync to async file operations
# Add input sanitization

# 4. Fix CI/CD gaps
# Add integration tests to CI
# Add cargo-deny job
# Fix coverage threshold mismatch
```

### Week 2: Code Quality

```bash
# 1. Split cli.rs into modules
# 2. Consolidate token counting
# 3. Standardize error handling
# 4. Fix duplicate memory systems
```

### Week 3: Testing & Documentation

```bash
# 1. Add system tests to CI
# 2. Fix documentation-code sync issues
# 3. Consolidate duplicate docs
# 4. Add weekly ignored-test job
```

### Week 4: Polish

```bash
# 1. Website performance improvements
# 2. TUI configurability
# 3. Garden optimization
# 4. Add benchmarks
```

---

## 📊 Detailed Findings by Module

### Core Modules (src/)

| Module | Lines | Key Issues |
|--------|-------|------------|
| `agent/` | ~17,500 | Blocking I/O, large files (execution.rs: 3,054 lines) |
| `tools/` | ~7,500 | Test mode bypass, FIM injection |
| `cognitive/` | ~35,000 | Duplicate memory systems, std::sync in async |
| `orchestration/` | ~14,000 | Large files (multiagent.rs: 3,323 lines) |
| `safety/` | ~4,500 | TOCTOU race, YOLO bypass |
| `ui/` | ~12,000 | cli.rs bloat (50K lines), hardcoded FPS |
| `api/` | ~3,500 | Good - no major issues |

### Configuration

| File | Issue | Recommendation |
|------|-------|----------------|
| `Cargo.toml` | 12 features, 7 are placeholders | Remove or implement placeholder features |
| `deny.toml` | 4 ignored advisories, no CI | Add cargo-deny job, set review dates |
| `.pre-commit-config.yaml` | Full test suite on push | Run only fast tests |

### Documentation Files

| File | Status | Action |
|------|--------|--------|
| `README.md` | ✅ Good | Keep |
| `ARCHITECTURE_SUMMARY.md` | ✅ Good | Keep |
| `PROJECT_REVIEW_2026_03_06.md` | ⚠️ Duplicate | Merge into REVIEW.md |
| `COMPREHENSIVE_PROJECT_REVIEW.md` | ⚠️ Duplicate | Archive |
| `QUICK_FIXES.md` | ⚠️ Subset | Merge into REVIEW.md |
| `docs/*` | ⚠️ Overlapping | Consolidate Swarm UI guides |

---

## 🔍 Positive Findings

### Security (Well Done)

1. **Strong path traversal protection** - O_NOFOLLOW, homoglyph detection
2. **Comprehensive shell filtering** - Base64 detection, quote obfuscation checks
3. **SSRF protection** - Cloud metadata blocking, private IP checks
4. **Secret scanning** - AWS, GitHub, JWT token detection
5. **Audit logging** - Comprehensive trail

### Code Quality (Well Done)

1. **Good async patterns** - Mostly proper tokio usage
2. **Strong error hierarchy** - `thiserror` usage in `errors.rs`
3. **Checkpoint/resilience** - Good persistence mechanisms
4. **Comprehensive tool system** - 54 well-structured tools

### Testing (Well Done)

1. **~6,400 unit tests** with ~82% coverage
2. **Property-based tests** for parsers and safety
3. **SAB benchmark** with 12 scenarios
4. **Fuzz targets** for security-critical code

---

## 📁 Recommended File Structure Changes

```
~/selfware/
├── src/
│   ├── cli/              # Split from cli.rs
│   │   ├── mod.rs
│   │   ├── commands.rs
│   │   ├── handlers.rs
│   │   └── init_wizard.rs
│   └── cognitive/
│       └── memory/       # Consolidated memory systems
│           ├── mod.rs
│           ├── hierarchy.rs
│           ├── episodic.rs
│           └── semantic.rs
├── docs/
│   ├── README.md         # Add navigation
│   ├── adr/              # Architecture decisions
│   └── api/              # Generated tool docs
└── REVIEW.md             # Consolidated review

~/selfware.design/
├── src/
│   ├── components/       # Split from index.html
│   ├── hooks/
│   └── styles/
├── server.js             # Security fixes
└── package.json          # Add proper deps
```

---

## 🎯 Success Metrics

After completing P0 + P1 issues:

- [ ] Zero critical security vulnerabilities
- [ ] All async code uses non-blocking I/O
- [ ] CI runs all test types
- [ ] No files >2000 lines
- [ ] Single source of truth for token counting
- [ ] Consolidated memory system
- [ ] Website rate-limited and async
- [ ] Documentation accurate and consolidated

---

*Generated by multi-agent code review team*  
*Each finding includes file paths and line numbers for easy location*
