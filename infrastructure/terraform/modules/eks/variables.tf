# Terraform AWS EKS Module Variables
# terraform >= 1.6.0

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster"
  validation {
    condition     = length(var.cluster_name) <= 40 && can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.cluster_name))
    error_message = "Cluster name must be 40 characters or less, start with a letter, and contain only alphanumeric characters and hyphens"
  }
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version to use for the EKS cluster"
  default     = "1.28"
  validation {
    condition     = can(regex("^1\\.(2[4-8])$", var.kubernetes_version))
    error_message = "Kubernetes version must be between 1.24 and 1.28"
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the EKS cluster will be created"
  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must start with 'vpc-'"
  }
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs where the EKS nodes will be deployed"
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnets must be provided for high availability"
  }
}

variable "node_groups" {
  type = map(object({
    instance_types = list(string)
    desired_size   = number
    min_size      = number
    max_size      = number
    disk_size     = number
    labels        = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
    capacity_type = string
  }))
  description = "Map of EKS node group configurations with support for spot instances and taints"
  default = {
    system = {
      instance_types = ["t3.xlarge"]
      desired_size   = 2
      min_size      = 2
      max_size      = 4
      disk_size     = 100
      labels = {
        role = "system"
      }
      taints        = []
      capacity_type = "ON_DEMAND"
    }
    application = {
      instance_types = ["t3.2xlarge"]
      desired_size   = 3
      min_size      = 2
      max_size      = 8
      disk_size     = 200
      labels = {
        role = "application"
      }
      taints        = []
      capacity_type = "ON_DEMAND"
    }
  }
}

variable "enable_private_access" {
  type        = bool
  description = "Enable private API server endpoint access"
  default     = true
}

variable "enable_public_access" {
  type        = bool
  description = "Enable public API server endpoint access"
  default     = false
}

variable "public_access_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks allowed to access the public API server endpoint"
  default     = []
  validation {
    condition     = alltrue([for cidr in var.public_access_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All elements must be valid CIDR blocks"
  }
}

variable "kms_key_arn" {
  type        = string
  description = "ARN of the KMS key for encrypting Kubernetes secrets"
  validation {
    condition     = var.kms_key_arn == null || can(regex("^arn:aws:kms:", var.kms_key_arn))
    error_message = "KMS key ARN must be a valid AWS KMS key ARN"
  }
}

variable "enabled_cluster_log_types" {
  type        = list(string)
  description = "List of EKS cluster control plane logging types to enable"
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  validation {
    condition = alltrue([
      for log_type in var.enabled_cluster_log_types : contains(
        ["api", "audit", "authenticator", "controllerManager", "scheduler"],
        log_type
      )
    ])
    error_message = "Invalid log type specified. Valid values are: api, audit, authenticator, controllerManager, scheduler"
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to all resources created by this module"
  default     = {}
}