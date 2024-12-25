# Configure Terraform version and required providers
terraform {
  # Terraform version constraint as specified in technical requirements
  required_version = ">= 1.6.0"

  required_providers {
    # AWS provider configuration with version constraint
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Note: Backend configuration should be in a separate backend.tf file
  # or configured via backend partial configuration for environment flexibility
}

# Configure the AWS Provider with region and default tags
provider "aws" {
  # Dynamic region configuration from variables
  region = var.aws_region

  # Default tags to be applied to all resources
  default_tags {
    tags = {
      Project             = "knowledge-curator"
      Environment         = var.environment
      ManagedBy          = "terraform"
      Service            = "knowledge-aggregation"
      CostCenter         = "engineering"
      SecurityCompliance = "required"
      Owner              = "platform-team"
      LastUpdated        = timestamp()
    }
  }

  # Provider-level configuration for enhanced security and compliance
  default_tags {
    tags = {
      DataClassification = "confidential"
      BackupPolicy      = "required"
      MonitoringLevel   = "enhanced"
    }
  }

  # Enable AWS provider features for better security and management
  skip_credentials_validation = false
  skip_region_validation     = false
  skip_metadata_api_check    = false
  skip_requesting_account_id = false

  # Configure retry behavior for API calls
  retry_mode = "standard"
  max_retries = 3
}

# Configure AWS provider alias for secondary region (DR)
provider "aws" {
  alias  = "secondary"
  region = "us-east-1" # Secondary region for DR

  # Inherit default tags from primary provider
  default_tags {
    tags = {
      Project             = "knowledge-curator"
      Environment         = var.environment
      ManagedBy          = "terraform"
      Service            = "knowledge-aggregation"
      CostCenter         = "engineering"
      SecurityCompliance = "required"
      Owner              = "platform-team"
      LastUpdated        = timestamp()
      Region            = "secondary"
    }
  }

  # Same security and validation settings as primary provider
  skip_credentials_validation = false
  skip_region_validation     = false
  skip_metadata_api_check    = false
  skip_requesting_account_id = false

  retry_mode = "standard"
  max_retries = 3
}

# Data source to get current AWS region for reference
data "aws_region" "current" {}

# Data source to get current AWS caller identity
data "aws_caller_identity" "current" {}