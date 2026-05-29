# Development Workflow

## Feature Development Example

### 1. Create Branch

git checkout main
git pull
git checkout -b feature/eu-routing

### 2. Develop Feature
- Implement feature
- Update documentation
- Add tests

### 3. Verify

pytest
pytest --cov=app

### 4. Commit

git add .
git commit -m "Add EU routing support"

### 5. Push

git push origin feature/eu-routing

### 6. Pull Request
- Review code
- Verify tests pass
- Approve changes

### 7. Merge
- Squash and merge into main

### 8. Release
- Run regression checklist
- Deploy
- Verify health checks

## Why This Process?
- Prevents unstable code reaching main
- Ensures every feature is tested
- Provides traceability and review history
