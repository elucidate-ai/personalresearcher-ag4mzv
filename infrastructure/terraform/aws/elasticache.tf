# Provider configuration with version constraint
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Redis auth token in AWS Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name = "${var.environment}-redis-auth-token"
  description = "Authentication token for Redis cluster"
  
  tags = {
    Name        = "${var.environment}-redis-auth-token"
    Environment = var.environment
    Project     = "knowledge-curator"
    ManagedBy   = "terraform"
    SecurityLevel = "high"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.redis_auth_token.result
}

resource "random_password" "redis_auth_token" {
  length           = 32
  special          = true
  override_special = "!&#$^<>-"
}

# SNS topic for Redis notifications
resource "aws_sns_topic" "redis_notifications" {
  name = "${var.environment}-redis-notifications"
  
  tags = {
    Name        = "${var.environment}-redis-notifications"
    Environment = var.environment
    Project     = "knowledge-curator"
    ManagedBy   = "terraform"
  }
}

# ElastiCache subnet group
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.environment}-redis-subnet-group"
  description = "Subnet group for Redis cluster"
  subnet_ids  = var.private_subnet_ids
  
  tags = {
    Name         = "${var.environment}-redis-subnet-group"
    Environment  = var.environment
    Project      = "knowledge-curator"
    ManagedBy    = "terraform"
    CreatedAt    = timestamp()
    SecurityZone = "private"
  }
}

# ElastiCache parameter group with production-optimized settings
resource "aws_elasticache_parameter_group" "redis" {
  family      = "redis7.0"
  name        = "${var.environment}-redis-params"
  description = "Production Redis parameter group for knowledge curator"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  tags = {
    Name        = "${var.environment}-redis-params"
    Environment = var.environment
    Project     = "knowledge-curator"
    ManagedBy   = "terraform"
  }
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow Redis traffic from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow outbound traffic"
  }

  tags = {
    Name          = "${var.environment}-redis-sg"
    Environment   = var.environment
    Project       = "knowledge-curator"
    ManagedBy     = "terraform"
    SecurityLevel = "high"
  }
}

# ElastiCache replication group (Redis cluster)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.environment}-redis-cluster"
  description                   = "Production Redis cluster for knowledge curator"
  node_type                     = var.elasticache_node_type
  num_cache_clusters           = var.elasticache_num_cache_nodes
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  port                         = 6379
  subnet_group_name            = aws_elasticache_subnet_group.redis.name
  security_group_ids           = [aws_security_group.redis.id]
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  engine                       = "redis"
  engine_version              = "7.0"
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                  = aws_secretsmanager_secret_version.redis_auth_token.secret_string
  maintenance_window          = "sun:05:00-sun:09:00"
  snapshot_window             = "00:00-04:00"
  snapshot_retention_limit    = 7
  auto_minor_version_upgrade = true
  notification_topic_arn     = aws_sns_topic.redis_notifications.arn

  tags = {
    Name              = "${var.environment}-redis-cluster"
    Environment       = var.environment
    Project          = "knowledge-curator"
    ManagedBy        = "terraform"
    CreatedAt        = timestamp()
    SecurityLevel    = "high"
    BackupEnabled    = "true"
    MonitoringEnabled = "true"
  }
}

# Outputs
output "redis_endpoint" {
  description = "Primary endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  description = "Port number of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_connection_string" {
  description = "Formatted connection string for Redis cluster"
  value       = format("redis://%s:%s", 
    aws_elasticache_replication_group.redis.primary_endpoint_address,
    aws_elasticache_replication_group.redis.port
  )
  sensitive   = true
}