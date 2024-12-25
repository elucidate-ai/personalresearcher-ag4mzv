# Knowledge Aggregation System Backend
Version: 1.0.0  
Last Updated: 2024-01-20  
Maintainers: DevOps Team, Backend Team

## Quick Start

### Prerequisites
- Docker v24+
- Node.js v20+
- Python 3.11+
- Git

### Local Development Setup
1. Clone the repository and navigate to backend directory:
```bash
git clone <repository-url>
cd src/backend
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start development environment:
```bash
docker-compose up -d
```

4. Verify services:
```bash
curl http://localhost:8080/health
```

## Architecture Overview

### System Components
- API Gateway (Node.js 20 LTS)
- Content Discovery Service (Python 3.11)
- Vector Service (Python 3.11)
- Knowledge Organization Service (Python 3.11)
- Output Generation Service (Node.js 20 LTS)

### Data Stores
- Vector Database (Pinecone)
- Graph Database (Neo4j)
- Document Store (MongoDB)
- Cache Layer (Redis)

### Service Communication
- Internal: gRPC
- External: REST APIs
- Event Bus: Apache Kafka

## Development Guide

### Project Structure
```
src/backend/
├── api-gateway/         # API Gateway service
├── content-discovery/   # Content Discovery service
├── vector-service/     # Vector Processing service
├── knowledge-service/  # Knowledge Organization service
├── output-service/     # Output Generation service
├── docker-compose.yml  # Development orchestration
├── .env.example        # Environment template
└── README.md          # This file
```

### Development Workflow
1. Create feature branch from `main`
2. Implement changes following coding standards
3. Write/update tests
4. Submit PR for review
5. Address review feedback
6. Merge after approval

### Code Standards
- Python: PEP 8
- Node.js: Airbnb Style Guide
- API Documentation: OpenAPI 3.0
- Commit Messages: Conventional Commits

## API Documentation

### Service Endpoints

#### API Gateway (Port 8080)
- `GET /health` - Service health check
- `POST /api/v1/topics` - Create topic search
- `GET /api/v1/content/{topicId}` - Retrieve content
- `GET /api/v1/graph/{topicId}` - Get knowledge graph
- `POST /api/v1/export/{topicId}` - Generate output

### Authentication
- JWT-based authentication
- OAuth 2.0 / OpenID Connect
- Rate limiting: 1000 requests/hour/user

## Deployment Guide

### Production Deployment
1. Configure environment variables
2. Build production images:
```bash
docker build -f Dockerfile.api-gateway -t api-gateway:latest .
# Repeat for other services
```

3. Push to container registry:
```bash
docker push <registry>/api-gateway:latest
```

4. Deploy to Kubernetes:
```bash
kubectl apply -f k8s/
```

### Environment Configuration
- Development: Local Docker Compose
- Staging: Single-region Kubernetes
- Production: Multi-region Kubernetes
- DR: Hot standby in alternate region

## Security

### Authentication Flow
1. Client authenticates with Auth0
2. Receives JWT token
3. Includes token in Authorization header
4. API Gateway validates token
5. Propagates authenticated context to services

### Authorization Matrix
| Role | Content Access | Vector Ops | Knowledge Graph | Export |
|------|---------------|------------|-----------------|---------|
| Anonymous | Read Public | Basic Search | View Only | No |
| Basic User | Read All | Full Search | View & Navigate | Basic |
| Premium | Read All | Advanced | Full Interactive | All |
| Admin | Full Access | Full Access | Full Access | Full |

## Monitoring

### Health Checks
- Readiness: `/health/ready`
- Liveness: `/health/live`
- Startup: `/health/startup`

### Metrics
- System: Prometheus + Grafana
- Business: Custom dashboards
- Alerts: PagerDuty integration

### Logging
- Structured JSON logging
- ELK Stack integration
- Log retention: 30 days

## Troubleshooting

### Common Issues
1. Service Connection Failures
   - Verify network connectivity
   - Check service health endpoints
   - Validate configuration

2. Database Connection Issues
   - Verify credentials
   - Check connection strings
   - Validate network access

3. Authentication Failures
   - Verify JWT configuration
   - Check token expiration
   - Validate client credentials

## Contributing

### Development Process
1. Fork repository
2. Create feature branch
3. Implement changes
4. Add/update tests
5. Submit pull request

### Pull Request Guidelines
- Reference issue number
- Include test coverage
- Update documentation
- Follow code standards

## Changelog

### v1.0.0 (2024-01-20)
- Initial release
- Core service implementation
- Basic authentication flow
- Development environment setup

### v0.9.0 (2023-12-15)
- Beta release
- Service integration testing
- Documentation updates
- Security improvements