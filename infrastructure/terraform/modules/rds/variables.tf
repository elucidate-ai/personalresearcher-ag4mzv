# Environment Configuration
variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, staging, prod)"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Network Configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where DocumentDB cluster will be deployed"
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for DocumentDB cluster placement in multiple availability zones"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block of the VPC for security group rules and network access control"
}

# Instance Configuration
variable "instance_class" {
  type        = string
  description = "Instance class for DocumentDB cluster instances"
  default     = "db.r6g.2xlarge"
}

variable "instance_count" {
  type        = number
  description = "Number of instances in the DocumentDB cluster for high availability"
  default     = 3
  validation {
    condition     = var.instance_count >= 2
    error_message = "At least 2 instances required for high availability"
  }
}

# Authentication Configuration
variable "master_username" {
  type        = string
  description = "Master username for DocumentDB cluster administrator access"
  sensitive   = true
}

variable "master_password" {
  type        = string
  description = "Master password for DocumentDB cluster administrator access"
  sensitive   = true
}

# Backup Configuration
variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 7
  validation {
    condition     = var.backup_retention_period >= 7
    error_message = "Backup retention period must be at least 7 days for compliance"
  }
}

variable "preferred_backup_window" {
  type        = string
  description = "Daily time range during which automated backups are created"
  default     = "03:00-04:00"
}

# Maintenance Configuration
variable "preferred_maintenance_window" {
  type        = string
  description = "Weekly time range during which system maintenance can occur"
  default     = "sun:04:00-sun:05:00"
}

# Security Configuration
variable "encryption_kms_key_id" {
  type        = string
  description = "ARN of KMS key for encrypting the DocumentDB cluster"
  sensitive   = true
}

# Monitoring Configuration
variable "enable_performance_insights" {
  type        = bool
  description = "Enable Performance Insights for monitoring database performance"
  default     = true
}

# Tagging Configuration
variable "tags" {
  type        = map(string)
  description = "Additional tags for DocumentDB resources"
  default     = {}
}