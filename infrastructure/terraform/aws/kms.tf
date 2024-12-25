# Provider version constraints
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# KMS key for application data encryption (user credentials, content vectors, knowledge graphs)
resource "aws_kms_key" "application_key" {
  description              = "KMS key for encrypting application data with automatic rotation"
  deletion_window_in_days  = 30
  enable_key_rotation     = true
  is_enabled              = var.security_config.enable_encryption
  customer_master_key_spec = "SYMMETRIC_DEFAULT"  # AES-256-GCM
  key_usage               = "ENCRYPT_DECRYPT"
  multi_region            = true  # Enable multi-region replication for DR

  # Key policy allowing root account and enabling key administrators
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Key Administration"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/KMSAdminRole"
        }
        Action = [
          "kms:Create*",
          "kms:Describe*",
          "kms:Enable*",
          "kms:List*",
          "kms:Put*",
          "kms:Update*",
          "kms:Revoke*",
          "kms:Disable*",
          "kms:Get*",
          "kms:Delete*",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name              = "${var.environment}-application-kms-key"
    Environment       = var.environment
    Purpose          = "application-encryption"
    ManagedBy        = "terraform"
    ComplianceScope  = "SOC2-ISO27001"
    DataClassification = "sensitive"
    AutoRotation     = "enabled"
    EncryptionType   = "AES-256-GCM"
  })
}

# KMS alias for application key
resource "aws_kms_alias" "application_key_alias" {
  name          = "alias/${var.environment}-application-key"
  target_key_id = aws_kms_key.application_key.key_id
}

# KMS key for database encryption (DocumentDB, ElastiCache)
resource "aws_kms_key" "database_key" {
  description              = "KMS key for encrypting database data with automatic rotation"
  deletion_window_in_days  = 30
  enable_key_rotation     = true
  is_enabled              = var.security_config.enable_encryption
  customer_master_key_spec = "SYMMETRIC_DEFAULT"  # AES-256-GCM
  key_usage               = "ENCRYPT_DECRYPT"
  multi_region            = true  # Enable multi-region replication for DR

  # Key policy allowing root account and enabling key administrators
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Database Service Access"
        Effect = "Allow"
        Principal = {
          Service = [
            "docdb.amazonaws.com",
            "elasticache.amazonaws.com"
          ]
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:ListGrants",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name              = "${var.environment}-database-kms-key"
    Environment       = var.environment
    Purpose          = "database-encryption"
    ManagedBy        = "terraform"
    ComplianceScope  = "SOC2-ISO27001"
    DataClassification = "sensitive"
    AutoRotation     = "enabled"
    EncryptionType   = "AES-256-GCM"
  })
}

# KMS alias for database key
resource "aws_kms_alias" "database_key_alias" {
  name          = "alias/${var.environment}-database-key"
  target_key_id = aws_kms_key.database_key.key_id
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Outputs for key references
output "application_kms_key_id" {
  description = "ID of the KMS key used for application data encryption"
  value       = aws_kms_key.application_key.key_id
}

output "application_kms_key_arn" {
  description = "ARN of the KMS key used for application data encryption"
  value       = aws_kms_key.application_key.arn
}

output "database_kms_key_id" {
  description = "ID of the KMS key used for database encryption"
  value       = aws_kms_key.database_key.key_id
}

output "database_kms_key_arn" {
  description = "ARN of the KMS key used for database encryption"
  value       = aws_kms_key.database_key.arn
}