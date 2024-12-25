# Test Suite Documentation
> AI-Powered Knowledge Aggregation System Test Suite

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Security Testing](#security-testing)
- [Performance Testing](#performance-testing)
- [Test Data Management](#test-data-management)

## Overview

This test suite provides comprehensive testing capabilities for the AI-powered knowledge aggregation system. The testing infrastructure covers all system components including:

- API Gateway Service
- Content Discovery Service
- Knowledge Organization Service
- Vector Service
- Output Generation Service
- Supporting Infrastructure (Databases, Cache, etc.)

### Test Categories

| Category | Purpose | Tools |
|----------|---------|-------|
| Unit Tests | Component-level testing | Jest (TS/JS), pytest (Python) |
| Integration Tests | Service interaction testing | Jest, pytest, Postman |
| End-to-End Tests | Full system flow testing | Cypress, Selenium |
| Performance Tests | System performance validation | k6, Apache JMeter |
| Load Tests | System scalability testing | k6, Artillery |
| Security Tests | Security validation | OWASP ZAP, SonarQube |
| API Tests | API contract testing | Postman, Pact |
| Database Tests | Data layer testing | MongoDB/Neo4j test suites |
| Cache Tests | Caching layer validation | Redis test suite |
| DR Tests | Disaster recovery validation | Custom test suite |

## Prerequisites

### Required Software
- Docker Engine 24.0+
- Docker Compose 2.20+
- Node.js 20 LTS
- Python 3.11+
- Java 17+ (for specific test tools)

### System Requirements
- Minimum 16GB RAM
- 4+ CPU cores
- 50GB available storage
- Network access to mock services

## Environment Setup

### 1. Clone and Configure
```bash
# Clone the repository
git clone <repository-url>
cd src/test

# Install dependencies
npm install  # For JavaScript/TypeScript tests
pip install -r requirements.txt  # For Python tests

# Configure environment
cp .env.example .env
```

### 2. Start Test Environment
```bash
# Start all test services
docker-compose -f docker-compose.test.yml up -d

# Verify service health
./scripts/health-check.sh
```

### 3. Initialize Test Data
```bash
# Initialize test databases
./scripts/init-test-data.sh

# Verify data setup
./scripts/verify-test-data.sh
```

## Running Tests

### Unit Tests
```bash
# JavaScript/TypeScript tests
npm run test:unit

# Python tests
pytest tests/unit
```

### Integration Tests
```bash
# Run all integration tests
npm run test:integration

# Run specific service tests
pytest tests/integration/vector-service
```

### End-to-End Tests
```bash
# Run E2E test suite
npm run test:e2e

# Run specific E2E scenarios
npm run test:e2e -- --spec "knowledge-graph-flow"
```

## Test Coverage

### Coverage Requirements
- Unit Test Coverage: >90%
- Integration Test Coverage: >85%
- E2E Critical Path Coverage: 100%

### Generate Coverage Reports
```bash
# Generate combined coverage report
npm run test:coverage

# Generate service-specific coverage
pytest --cov=vector_service tests/
```

## CI/CD Integration

### GitHub Actions Integration
```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Run Tests
      run: |
        docker-compose -f docker-compose.test.yml up -d
        npm run test:ci
```

### Test Automation Schedule
- Unit Tests: On every PR
- Integration Tests: On every PR
- E2E Tests: On main branch merge
- Performance Tests: Daily
- Security Tests: Weekly

## Troubleshooting

### Common Issues

1. Test Environment Startup
```bash
# Reset test environment
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

2. Database Connection Issues
```bash
# Verify database connectivity
./scripts/verify-db-connections.sh
```

3. Cache Issues
```bash
# Clear test cache
./scripts/clear-test-cache.sh
```

## Security Testing

### Security Test Suite
```bash
# Run security test suite
npm run test:security

# Run specific security tests
npm run test:security -- --suite "authentication"
```

### Compliance Validation
```bash
# Run compliance checks
npm run test:compliance

# Generate compliance report
npm run test:compliance -- --report
```

## Performance Testing

### Performance Thresholds
- API Response Time: <100ms
- Database Query Time: <50ms
- Vector Search Time: <200ms
- Cache Response Time: <10ms
- End-to-End Request Time: <500ms

### Running Performance Tests
```bash
# Run performance test suite
npm run test:performance

# Run load tests
k6 run load-tests/knowledge-graph-load.js
```

## Test Data Management

### Test Data Setup
```bash
# Generate test data
./scripts/generate-test-data.sh

# Import test datasets
./scripts/import-test-data.sh
```

### Data Privacy
- Test data must not contain PII
- Sensitive data must be masked
- Production data must never be used in tests

### Test Data Cleanup
```bash
# Clean test data
./scripts/cleanup-test-data.sh

# Verify data cleanup
./scripts/verify-data-cleanup.sh
```

## Contributing

1. Follow the test naming convention:
   - Unit tests: `*.test.ts` or `test_*.py`
   - Integration tests: `*.integration.test.ts` or `test_*_integration.py`
   - E2E tests: `*.e2e.test.ts` or `test_*_e2e.py`

2. Update test documentation when adding new tests

3. Maintain test coverage requirements

4. Add appropriate test markers and categories

## License

Copyright © 2024 AI-Powered Knowledge Aggregation System