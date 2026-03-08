# Selfware Trial — Demo Guide

Welcome to the selfware trial! You have 15 minutes to explore 4 demo scenarios that showcase different AI-driven development capabilities.

---

## Demo 1: Bug Fixing (`demo-1-bugs/`)

A weather CLI with 3 intentional bugs: wrong formula, off-by-one error, unused import.

```bash
cd /workspace/demo-1-bugs
selfware run "find and fix all bugs, then run cargo test to verify"
```

---

## Demo 2: Security Audit (`demo-2-security/`)

An API handler with 4 security vulnerabilities: hardcoded secret, path traversal, unsafe memory access, missing input validation.

```bash
cd /workspace/demo-2-security
selfware run "perform a security audit and fix all vulnerabilities"
```

---

## Demo 3: Test Generation (`demo-3-tests/`)

A string utils library with 5 clean functions and zero tests. See if selfware can generate comprehensive coverage.

```bash
cd /workspace/demo-3-tests
selfware run "generate comprehensive unit tests, cover edge cases, run cargo test"
```

---

## Demo 4: Build a Feature (`demo-4-feature/`)

A mini-grep CLI with a `search()` function stubbed as `todo!()`. The README describes the full spec.

```bash
cd /workspace/demo-4-feature
selfware run "implement the search function based on the README spec, add tests, verify"
```

---

## Tips

- Each demo is a standalone Rust project — just `cd` into it and run
- Run `cargo test` in any demo to see the current state
- selfware has 30 iterations max per run
- Your workspace is ephemeral — nothing persists after the session ends
