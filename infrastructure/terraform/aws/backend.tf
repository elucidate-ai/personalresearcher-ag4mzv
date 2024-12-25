# Terraform Backend Configuration
# Version: ~> 1.6
# Purpose: Defines secure and scalable state storage with cross-region replication

terraform {
  backend "s3" {
    # Primary state bucket configuration
    bucket         = "knowledge-curator-terraform-state"
    key            = "aws/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    
    # State locking configuration using DynamoDB
    dynamodb_table = "knowledge-curator-terraform-locks"
    
    # Enhanced security configuration
    kms_key_id     = "aws_kms_key.terraform_state_key.id"
    
    # Enable versioning for state history
    versioning     = true
    
    # Cross-region replication configuration for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication-role"
      rules {
        id       = "state-replication-rule"
        status   = "Enabled"
        priority = 1
        
        destination {
          bucket        = "arn:aws:s3:::knowledge-curator-terraform-state-replica"
          storage_class = "STANDARD"
          
          # Enable encryption for replicated objects
          encryption_configuration {
            replica_kms_key_id = "arn:aws:kms:REPLICA_REGION:ACCOUNT_ID:key/replica-key-id"
          }
          
          # Enable metrics for replication monitoring
          metrics {
            status  = "Enabled"
            minutes = 15
          }
        }
      }
    }
    
    # Access logging configuration
    logging {
      target_bucket = "knowledge-curator-terraform-logs"
      target_prefix = "terraform-state/"
    }
    
    # VPC endpoint configuration for enhanced security
    endpoint_config {
      vpc_endpoint_id = "vpce-id"
    }
    
    # Force SSL/TLS for all operations
    force_ssl = true
    
    # Enable server-side object ownership
    object_ownership = "BucketOwnerEnforced"
  }
}

# Backend configuration validation
locals {
  backend_validation = {
    state_bucket_name     = "knowledge-curator-terraform-state"
    dynamodb_table_name   = "knowledge-curator-terraform-locks"
    logging_bucket_name   = "knowledge-curator-terraform-logs"
    replica_bucket_name   = "knowledge-curator-terraform-state-replica"
    required_providers    = ["aws"]
    minimum_version      = "1.6.0"
  }
}

# Backend health check
data "aws_s3_bucket" "state_bucket" {
  bucket = local.backend_validation.state_bucket_name
}

data "aws_dynamodb_table" "lock_table" {
  name = local.backend_validation.dynamodb_table_name
}