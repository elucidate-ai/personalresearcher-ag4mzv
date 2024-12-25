# Provider configuration with version constraint
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# IAM role for DocumentDB enhanced monitoring
resource "aws_iam_role" "docdb_monitoring" {
  name = "${var.environment}-docdb-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-docdb-monitoring-role"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Attach enhanced monitoring policy to the IAM role
resource "aws_iam_role_policy_attachment" "docdb_monitoring" {
  role       = aws_iam_role.docdb_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Security group for DocumentDB cluster
resource "aws_security_group" "docdb" {
  name        = "${var.environment}-docdb-sg"
  description = "Security group for DocumentDB cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
    description     = "Allow MongoDB protocol access from application"
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
    ManagedBy   = "terraform"
  }
}

# Fetch DocumentDB credentials from AWS Secrets Manager
data "aws_secretsmanager_secret_version" "docdb_master_user" {
  secret_id = "docdb-master-username-${var.environment}"
}

data "aws_secretsmanager_secret_version" "docdb_master_pass" {
  secret_id = "docdb-master-password-${var.environment}"
}

# DocumentDB parameter group
resource "aws_docdb_cluster_parameter_group" "main" {
  family = "docdb4.0"
  name   = "${var.environment}-docdb-params"

  parameter {
    name  = "tls"
    value = "enabled"
  }

  parameter {
    name  = "audit_logs"
    value = "enabled"
  }

  parameter {
    name  = "ttl_monitor"
    value = "enabled"
  }

  tags = {
    Name        = "${var.environment}-docdb-params"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# DocumentDB subnet group
resource "aws_docdb_subnet_group" "main" {
  name       = "${var.environment}-docdb-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name        = "${var.environment}-docdb-subnet-group"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# DocumentDB cluster
module "documentdb" {
  source = "../modules/rds"

  vpc_id                       = aws_vpc.main.id
  subnet_ids                   = aws_subnet.private[*].id
  environment                  = var.environment
  instance_class              = var.documentdb_config.instance_class
  instance_count              = var.documentdb_config.instances
  backup_retention_period     = var.documentdb_config.backup_retention
  master_username             = data.aws_secretsmanager_secret_version.docdb_master_user.secret_string
  master_password             = data.aws_secretsmanager_secret_version.docdb_master_pass.secret_string
  kms_key_id                  = var.security_config.kms_key_id
  storage_encrypted           = true
  tls_enabled                 = true
  audit_logs_enabled          = true
  preferred_backup_window     = var.documentdb_config.preferred_backup_window
  preferred_maintenance_window = var.documentdb_config.preferred_maintenance_window
  enhanced_monitoring_role_arn = aws_iam_role.docdb_monitoring.arn
  performance_insights_enabled = true
  cloudwatch_log_exports      = ["audit", "profiler"]
  parameter_group_settings    = aws_docdb_cluster_parameter_group.main.id
  security_group_ids          = [aws_security_group.docdb.id]
  subnet_group_name           = aws_docdb_subnet_group.main.name

  tags = {
    Project     = "knowledge-curator"
    Environment = var.environment
    ManagedBy   = "terraform"
    Compliance  = "gdpr"
    Backup      = "required"
  }
}

# CloudWatch alarms for DocumentDB monitoring
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
  alarm_actions      = [var.monitoring_config.alarm_notification_arn]

  dimensions = {
    DBClusterIdentifier = module.documentdb.cluster_identifier
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Outputs
output "documentdb_cluster_endpoint" {
  description = "Primary endpoint for DocumentDB cluster"
  value       = module.documentdb.cluster_endpoint
}

output "documentdb_reader_endpoint" {
  description = "Reader endpoint for DocumentDB cluster"
  value       = module.documentdb.reader_endpoint
}

output "documentdb_monitoring_role_arn" {
  description = "ARN of IAM role used for enhanced monitoring"
  value       = aws_iam_role.docdb_monitoring.arn
}