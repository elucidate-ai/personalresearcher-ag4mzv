# Provider configuration with version constraints
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# KMS key for EKS cluster encryption
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true

  tags = {
    Name        = "${var.eks_cluster_config.cluster_name}-kms"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# IAM role for EKS cluster
resource "aws_iam_role" "eks_cluster" {
  name = "${var.eks_cluster_config.cluster_name}-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.eks_cluster_config.cluster_name}-cluster-role"
    Environment = var.environment
  }
}

# Attach required policies to cluster role
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = var.eks_cluster_config.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.eks_cluster_config.version

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  tags = {
    Name        = var.eks_cluster_config.cluster_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}

# Node group IAM role
resource "aws_iam_role" "eks_node_group" {
  name = "${var.eks_cluster_config.cluster_name}-node-group-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# Attach required policies to node group role
resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_group.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_group.name
}

# EKS Node Groups
resource "aws_eks_node_group" "api_services" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "api-services"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = 2
    max_size     = 10
    min_size     = 2
  }

  instance_types = ["t3.xlarge"]

  labels = {
    role = "api"
  }

  tags = {
    Name        = "${var.eks_cluster_config.cluster_name}-api-services"
    Environment = var.environment
  }
}

resource "aws_eks_node_group" "content_processing" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "content-processing"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = 2
    max_size     = 8
    min_size     = 2
  }

  instance_types = ["c6i.2xlarge"]

  labels = {
    role = "content"
  }

  tags = {
    Name        = "${var.eks_cluster_config.cluster_name}-content-processing"
    Environment = var.environment
  }
}

resource "aws_eks_node_group" "vector_operations" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "vector-operations"
  node_role_arn   = aws_iam_role.eks_node_group.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = 2
    max_size     = 6
    min_size     = 2
  }

  instance_types = ["g4dn.xlarge"]

  labels = {
    role = "vector"
  }

  tags = {
    Name        = "${var.eks_cluster_config.cluster_name}-vector-operations"
    Environment = var.environment
  }
}

# Security group for EKS cluster
resource "aws_security_group" "eks_cluster" {
  name        = "${var.eks_cluster_config.cluster_name}-cluster-sg"
  description = "Security group for EKS cluster"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.eks_cluster_config.cluster_name}-cluster-sg"
    Environment = var.environment
  }
}

# CloudWatch Log Group for EKS cluster logs
resource "aws_cloudwatch_log_group" "eks_cluster" {
  name              = "/aws/eks/${var.eks_cluster_config.cluster_name}/cluster"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.eks.arn

  tags = {
    Name        = "${var.eks_cluster_config.cluster_name}-logs"
    Environment = var.environment
  }
}

# Outputs
output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_security_group.eks_cluster.id
}

output "cluster_iam_role_arn" {
  description = "IAM role ARN used by EKS cluster"
  value       = aws_iam_role.eks_cluster.arn
}

output "node_groups" {
  description = "Map of all EKS node groups and their configurations"
  value = {
    api_services       = aws_eks_node_group.api_services
    content_processing = aws_eks_node_group.content_processing
    vector_operations  = aws_eks_node_group.vector_operations
  }
}