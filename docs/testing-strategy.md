# Testing Strategy

## Purpose
This document explains how ParcelFlow testing prevents regressions and validates routing correctness.

## Test Pyramid
- Unit Tests: Rule engine, validation, authentication
- Integration Tests: API -> Queue -> Worker -> Database flow
- Manual Regression Tests: End-to-end business verification

## Coverage Goals
- Rule Engine: 90%+
- Services: 80%+
- Overall Backend: 80%+

## New Rule Process
1. Add rule
2. Add unit tests
3. Run pytest
4. Run regression checklist
5. Merge only if tests pass

## Beyond Automated Tests
- Boundary testing
- Exploratory testing
- Production log review
- User acceptance testing
 