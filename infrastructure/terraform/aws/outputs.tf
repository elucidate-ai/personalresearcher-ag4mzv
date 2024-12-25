# Core Infrastructure Outputs
output "vpc_id" {
  description = "ID of the VPC created for the knowledge aggregation system"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs where application workloads run"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for internet-facing resources"
  value       = module.vpc.public_subnet_ids
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint URL for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster for kubectl and other tooling"
  value       = module.eks.cluster_name
}

output "eks_cluster_security_group_id" {
  description = "ID of the security group attached to the EKS cluster for network policy configuration"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_certificate_authority" {
  description = "Base64 encoded certificate data for cluster authentication"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

# Database Outputs
output "documentdb_endpoint" {
  description = "Primary endpoint URL for the DocumentDB cluster used for metadata storage"
  value       = module.documentdb.endpoint
  sensitive   = true
}

output "documentdb_port" {
  description = "Port number for establishing DocumentDB connections"
  value       = module.documentdb.port
}

output "documentdb_connection_string" {
  description = "Connection string for DocumentDB with credentials"
  value       = module.documentdb.connection_string
  sensitive   = true
}

# Cache Outputs
output "elasticache_endpoint" {
  description = "Configuration endpoint URL for the ElastiCache Redis cluster used for caching"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "elasticache_port" {
  description = "Port number for establishing ElastiCache Redis connections"
  value       = module.elasticache.port
}

output "elasticache_connection_string" {
  description = "Connection string for ElastiCache Redis with auth token"
  value       = module.elasticache.connection_string
  sensitive   = true
}

# Security Outputs
output "kms_key_id" {
  description = "ID of the KMS key used for encrypting sensitive data at rest"
  value       = module.kms.key_id
  sensitive   = true
}

output "kms_key_arn" {
  description = "ARN of the KMS key for service integrations"
  value       = module.kms.key_arn
  sensitive   = true
}

# Networking Outputs
output "nat_gateway_ips" {
  description = "List of NAT Gateway public IPs for outbound internet access"
  value       = module.vpc.nat_gateway_ips
}

# Formatted Output for Application Configuration
output "infrastructure_outputs" {
  description = "Combined infrastructure outputs for application configuration"
  value = {
    vpc = {
      id             = module.vpc.vpc_id
      private_subnets = module.vpc.private_subnet_ids
      public_subnets  = module.vpc.public_subnet_ids
    }
    eks = {
      endpoint                = module.eks.cluster_endpoint
      name                   = module.eks.cluster_name
      security_group_id      = module.eks.cluster_security_group_id
    }
    databases = {
      documentdb = {
        endpoint = module.documentdb.endpoint
        port     = module.documentdb.port
      }
      elasticache = {
        endpoint = module.elasticache.endpoint
        port     = module.elasticache.port
      }
    }
    security = {
      kms_key_id = module.kms.key_id
    }
  }
  sensitive = true
}