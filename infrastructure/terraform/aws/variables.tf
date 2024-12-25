# AWS Region Configuration
variable "aws_region" {
  type        = string
  description = "AWS region for resource deployment with multi-region support"
  default     = "us-west-2"

  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-[a-z]+-\\d+$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment identifier with strict validation"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# VPC Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC with appropriate network segmentation"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

# EKS Cluster Configuration
variable "eks_cluster_config" {
  type        = map(any)
  description = "Comprehensive EKS cluster configuration"
  default = {
    version      = "1.28"
    cluster_name = "knowledge-curator"
    node_groups = {
      general = {
        instance_types = ["t3.xlarge", "t3.2xlarge"]
        min_size      = 2
        max_size      = 10
        desired_size  = 3
      }
      compute_intensive = {
        instance_types = ["c6i.2xlarge", "c6i.4xlarge"]
        min_size      = 1
        max_size      = 5
        desired_size  = 2
      }
    }
  }
}

# DocumentDB Configuration
variable "documentdb_config" {
  type        = map(any)
  description = "DocumentDB cluster configuration with high availability"
  default = {
    instance_class               = "db.r6g.2xlarge"
    instances                    = 3
    backup_retention            = 7
    preferred_backup_window     = "03:00-04:00"
    preferred_maintenance_window = "mon:04:00-mon:05:00"
    auto_minor_version_upgrade  = true
  }
}

# ElastiCache Configuration
variable "elasticache_config" {
  type        = map(any)
  description = "ElastiCache Redis cluster configuration"
  default = {
    node_type              = "cache.r6g.xlarge"
    num_cache_nodes        = 3
    parameter_group_family = "redis6.x"
    engine_version        = "6.x"
    automatic_failover    = true
    multi_az             = true
  }
}

# Security Configuration
variable "security_config" {
  type        = map(any)
  description = "Comprehensive security configuration"
  default = {
    enable_encryption = true
    kms_key_rotation = true
    ssl_enforcement  = true
    vpc_flow_logs   = true
    waf_enabled     = true
    shield_advanced = true
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  type        = map(any)
  description = "Enhanced monitoring configuration"
  default = {
    enable_cloudwatch            = true
    log_retention_days          = 30
    detailed_monitoring         = true
    alarm_notification_arn      = ""
    metrics_collection_interval = 60
  }
}

# Resource Tagging Strategy
variable "tags" {
  type        = map(string)
  description = "Resource tagging strategy"
  default = {
    Project     = "knowledge-curator"
    ManagedBy   = "terraform"
    Environment = null  # Will be set based on the environment variable
    Owner       = "platform-team"
    CostCenter  = "platform-engineering"
  }

  validation {
    condition     = var.tags["Project"] != null && var.tags["Project"] != ""
    error_message = "Project tag must be specified."
  }
}

# Backup Configuration
variable "backup_config" {
  type        = map(any)
  description = "Backup and disaster recovery configuration"
  default = {
    enable_cross_region_backup = true
    backup_retention_days     = 30
    cross_region_destination = {
      us-west-2 = "us-east-1"
      us-east-1 = "us-west-2"
    }
    backup_schedule          = "cron(0 5 ? * * *)"  # Daily at 5 AM UTC
    enable_point_in_time    = true
  }
}

# Network Configuration
variable "network_config" {
  type        = map(any)
  description = "Advanced networking configuration"
  default = {
    enable_vpc_endpoints     = true
    enable_transit_gateway   = false
    enable_network_firewall = true
    nat_gateway_per_az      = true
    enable_vpn_gateway      = false
    network_acl_rules = {
      inbound_http  = 80
      inbound_https = 443
      inbound_ssh   = 22
    }
  }

  validation {
    condition     = !var.network_config["enable_vpn_gateway"] || var.network_config["enable_network_firewall"]
    error_message = "Network firewall must be enabled when VPN gateway is enabled."
  }
}

# Cost Management Configuration
variable "cost_config" {
  type        = map(any)
  description = "Cost management and optimization configuration"
  default = {
    enable_cost_allocation_tags = true
    enable_budget_alerts       = true
    monthly_budget_amount     = 5000
    alert_threshold_percent   = 80
    enable_savings_plans     = true
    reserved_instance_term   = "1_year"
  }
}