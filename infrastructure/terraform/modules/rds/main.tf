# Provider version constraint
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws" # v5.0
      version = "~> 5.0"
    }
  }
}

# KMS key for DocumentDB encryption
resource "aws_kms_key" "docdb" {
  description             = "KMS key for DocumentDB cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true
  
  tags = {
    Name        = "${var.environment}-docdb-kms"
    Environment = var.environment
    Project     = "knowledge-curator"
    ManagedBy   = "terraform"
  }
}

# Security group for DocumentDB cluster
resource "aws_security_group" "docdb" {
  name_prefix = "${var.environment}-docdb-sg"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    cidr_blocks     = [var.vpc_cidr]
    description     = "Allow MongoDB protocol access from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.environment}-docdb-sg"
    Environment = var.environment
    Project     = "knowledge-curator"
    ManagedBy   = "terraform"
  }
}

# Subnet group for DocumentDB cluster
resource "aws_docdb_subnet_group" "main" {
  name        = "${var.environment}-docdb-subnet-group"
  subnet_ids  = var.subnet_ids
  
  tags = {
    Name        = "${var.environment}-docdb-subnet-group"
    Environment = var.environment
    Project     = "knowledge-curator"
    ManagedBy   = "terraform"
  }
}

# Parameter group for DocumentDB cluster
resource "aws_docdb_cluster_parameter_group" "main" {
  family      = "docdb5.0"
  name        = "${var.environment}-docdb-params"
  description = "Custom parameter group for DocumentDB cluster"

  parameter {
    name  = "tls"
    value = "enabled"
  }

  parameter {
    name  = "audit_logs"
    value = "enabled"
  }

  tags = {
    Name        = "${var.environment}-docdb-params"
    Environment = var.environment
    Project     = "knowledge-curator"
    ManagedBy   = "terraform"
  }
}

# DocumentDB cluster
resource "aws_docdb_cluster" "main" {
  cluster_identifier              = "${var.environment}-docdb-cluster"
  engine                         = "docdb"
  engine_version                 = "5.0.0"
  master_username                = var.master_username
  master_password                = var.master_password
  backup_retention_period        = var.backup_retention_period
  preferred_backup_window        = var.preferred_backup_window
  preferred_maintenance_window   = var.preferred_maintenance_window
  skip_final_snapshot           = false
  final_snapshot_identifier     = "${var.environment}-docdb-final-snapshot-${formatdate("YYYY-MM-DD", timestamp())}"
  vpc_security_group_ids        = [aws_security_group.docdb.id]
  db_subnet_group_name          = aws_docdb_subnet_group.main.name
  db_cluster_parameter_group_name = aws_docdb_cluster_parameter_group.main.name
  storage_encrypted             = true
  kms_key_id                    = aws_kms_key.docdb.arn
  enabled_cloudwatch_logs_exports = ["audit", "profiler"]
  deletion_protection           = true
  apply_immediately             = false

  tags = merge(
    var.tags,
    {
      Name             = "${var.environment}-docdb-cluster"
      Environment      = var.environment
      Project          = "knowledge-curator"
      ManagedBy        = "terraform"
      BackupRetention  = "${var.backup_retention_period}days"
      SecurityLevel    = "high"
    }
  )
}

# DocumentDB cluster instances
resource "aws_docdb_cluster_instance" "main" {
  count                           = var.instance_count
  identifier                      = "${var.environment}-docdb-${count.index}"
  cluster_identifier              = aws_docdb_cluster.main.id
  instance_class                  = var.instance_class
  auto_minor_version_upgrade      = true
  preferred_maintenance_window    = var.preferred_maintenance_window
  promotion_tier                  = count.index
  enable_performance_insights     = var.enable_performance_insights
  performance_insights_retention_period = 7

  tags = merge(
    var.tags,
    {
      Name            = "${var.environment}-docdb-${count.index}"
      Environment     = var.environment
      Role            = count.index == 0 ? "primary" : "replica"
      MonitoringLevel = "enhanced"
      Project         = "knowledge-curator"
      ManagedBy       = "terraform"
    }
  )
}

# CloudWatch alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "docdb_cpu" {
  alarm_name          = "${var.environment}-docdb-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/DocDB"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors DocumentDB CPU utilization"
  alarm_actions      = []  # Add SNS topic ARN for notifications

  dimensions = {
    DBClusterIdentifier = aws_docdb_cluster.main.cluster_identifier
  }
}

# Outputs
output "cluster_endpoint" {
  description = "Primary endpoint for DocumentDB cluster access"
  value       = aws_docdb_cluster.main.endpoint
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint for load-balanced read operations"
  value       = aws_docdb_cluster.main.reader_endpoint
}

output "cluster_instances" {
  description = "List of all cluster instance endpoints for monitoring"
  value       = aws_docdb_cluster_instance.main[*].endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID for DocumentDB cluster"
  value       = aws_security_group.docdb.id
}