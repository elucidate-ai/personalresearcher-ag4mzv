# AWS Provider version constraint
# AWS Provider v5.0+ for enhanced IAM policy management and security features
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# EKS Node Group IAM Role
resource "aws_iam_role" "eks_node_group" {
  name                 = "${var.eks_cluster_name}-node-group-role"
  description          = "IAM role for EKS node groups with enhanced security controls"
  assume_role_policy   = data.aws_iam_policy_document.eks_node_assume_role.json
  permissions_boundary = aws_iam_policy.node_boundary_policy.arn
  force_detach_policies = true

  tags = {
    Environment      = var.environment
    ManagedBy       = "terraform"
    SecurityLevel   = "high"
    Compliance      = "sox"
    LastReviewed    = timestamp()
  }
}

# Node Group Assume Role Policy
data "aws_iam_policy_document" "eks_node_assume_role" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region]
    }
  }
}

# Node Group Permission Boundary
resource "aws_iam_policy" "node_boundary_policy" {
  name        = "${var.environment}-eks-node-boundary"
  description = "Permission boundary for EKS node groups"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:*",
          "ecr:*",
          "logs:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.aws_region
          }
        }
      }
    ]
  })
}

# Node Group Policy Attachments
resource "aws_iam_role_policy_attachment" "eks_node_group_policies" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  ])

  policy_arn = each.value
  role       = aws_iam_role.eks_node_group.name
}

# Application IAM Role
resource "aws_iam_role" "application_role" {
  name                 = "${var.environment}-application-role"
  description          = "IAM role for application components with strict security controls"
  assume_role_policy   = data.aws_iam_policy_document.application_assume_role.json
  max_session_duration = 3600
  permissions_boundary = aws_iam_policy.app_boundary_policy.arn
  force_detach_policies = true

  tags = {
    Environment        = var.environment
    ManagedBy         = "terraform"
    SecurityLevel     = "high"
    DataClassification = "sensitive"
    LastReviewed      = timestamp()
  }
}

# Application Assume Role Policy
data "aws_iam_policy_document" "application_assume_role" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.aws_region]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:PrincipalTag/Environment"
      values   = [var.environment]
    }
  }
}

# Application Permission Boundary
resource "aws_iam_policy" "app_boundary_policy" {
  name        = "${var.environment}-app-boundary"
  description = "Permission boundary for application components"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*",
          "dynamodb:*",
          "sqs:*",
          "sns:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.aws_region,
            "aws:PrincipalTag/Environment": var.environment
          }
        }
      }
    ]
  })
}

# KMS Access Policy
resource "aws_iam_policy" "kms_access_policy" {
  name        = "${var.environment}-kms-access-policy"
  description = "Restricted KMS key access policy with audit requirements"
  
  policy = data.aws_iam_policy_document.kms_access.json

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    SecurityLevel = "critical"
    Compliance   = "pci"
    LastReviewed = timestamp()
  }
}

# KMS Access Policy Document
data "aws_iam_policy_document" "kms_access" {
  statement {
    effect = "Allow"
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:GenerateDataKey"
    ]
    
    resources = [
      aws_kms_key.application_key.arn,
      aws_kms_key.database_key.arn,
      aws_kms_key.cache_key.arn
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:PrincipalTag/Environment"
      values   = [var.environment]
    }

    condition {
      test     = "StringEquals"
      variable = "kms:EncryptionContext:Environment"
      values   = [var.environment]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["true"]
    }
  }
}

# Logging Policy for Node Groups
resource "aws_iam_policy" "node_logging_policy" {
  name        = "${var.environment}-node-logging-policy"
  description = "Enhanced logging policy for EKS nodes"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/eks/${var.eks_cluster_name}/*"
      }
    ]
  })
}

# Outputs
output "eks_node_group_role_arn" {
  description = "ARN of the IAM role used by EKS node groups with enhanced security"
  value       = aws_iam_role.eks_node_group.arn
}

output "application_role_arn" {
  description = "ARN of the IAM role used by application components with strict permissions"
  value       = aws_iam_role.application_role.arn
}