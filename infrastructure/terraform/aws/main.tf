# Main Terraform configuration for AWS infrastructure
# terraform >= 1.6.0
# Provider versions:
# aws: ~> 5.0

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Recommended backend configuration for state management
  backend "s3" {
    # Backend configuration should be provided via backend.hcl
    key            = "knowledge-curator/terraform.tfstate"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.tags, {
      Environment = var.environment
      ManagedBy   = "terraform"
    })
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  cidr                 = var.vpc_cidr
  environment         = var.environment
  availability_zones  = data.aws_availability_zones.available.names
  enable_flow_logs    = var.security_config.vpc_flow_logs
  enable_vpc_endpoints = var.network_config.enable_vpc_endpoints
  enable_nat_gateway  = true
  single_nat_gateway  = var.environment != "prod"

  tags = var.tags
}

# EKS Module
module "eks" {
  source = "../modules/eks"

  cluster_name         = "${var.environment}-${var.eks_cluster_config.cluster_name}"
  kubernetes_version   = var.eks_cluster_config.version
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  node_groups         = var.eks_cluster_config.node_groups
  enable_private_access = true
  enable_public_access = var.environment != "prod"
  public_access_cidrs = var.environment != "prod" ? ["0.0.0.0/0"] : []
  
  kms_key_arn = aws_kms_key.eks_secrets.arn
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  tags = var.tags
}

# DocumentDB Module
module "documentdb" {
  source = "./modules/documentdb"

  cluster_identifier     = "${var.environment}-docdb"
  instance_class        = var.documentdb_config.instance_class
  instances             = var.documentdb_config.instances
  vpc_id               = module.vpc.vpc_id
  subnet_ids           = module.vpc.private_subnet_ids
  backup_retention_period = var.documentdb_config.backup_retention
  preferred_backup_window = var.documentdb_config.preferred_backup_window
  enable_encryption     = var.security_config.enable_encryption
  kms_key_arn          = aws_kms_key.database.arn
  multi_az             = var.environment == "prod"

  tags = var.tags
}

# ElastiCache Module
module "elasticache" {
  source = "./modules/elasticache"

  cluster_id           = "${var.environment}-redis"
  node_type           = var.elasticache_config.node_type
  num_cache_nodes     = var.elasticache_config.num_cache_nodes
  parameter_group_family = var.elasticache_config.parameter_group_family
  engine_version      = var.elasticache_config.engine_version
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  
  automatic_failover_enabled = var.elasticache_config.automatic_failover
  multi_az_enabled         = var.elasticache_config.multi_az
  at_rest_encryption_enabled = var.security_config.enable_encryption
  transit_encryption_enabled = var.security_config.ssl_enforcement
  kms_key_arn             = aws_kms_key.database.arn

  tags = var.tags
}

# KMS Keys for encryption
resource "aws_kms_key" "database" {
  description             = "KMS key for database encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = var.security_config.kms_key_rotation

  tags = merge(var.tags, {
    Name = "${var.environment}-database-key"
  })
}

resource "aws_kms_key" "eks_secrets" {
  description             = "KMS key for EKS secrets encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = var.security_config.kms_key_rotation

  tags = merge(var.tags, {
    Name = "${var.environment}-eks-secrets-key"
  })
}

# Outputs
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS cluster API"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "documentdb_endpoint" {
  description = "DocumentDB cluster endpoint"
  value       = module.documentdb.endpoint
  sensitive   = true
}

output "elasticache_endpoint" {
  description = "ElastiCache cluster endpoint"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "monitoring_endpoints" {
  description = "Monitoring system endpoints"
  value = {
    prometheus    = module.eks.prometheus_endpoint
    grafana      = module.eks.grafana_endpoint
    alertmanager = module.eks.alertmanager_endpoint
  }
  sensitive = true
}