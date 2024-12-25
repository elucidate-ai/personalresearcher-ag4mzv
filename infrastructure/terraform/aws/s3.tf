# AWS S3 Configuration for Knowledge Aggregation System
# Version: 5.0 (AWS Provider)

# Content Storage Bucket
resource "aws_s3_bucket" "content_storage" {
  bucket = "${var.environment}-knowledge-content-storage"
  # Prevent accidental deletion in production
  force_destroy = var.environment != "prod" ? true : false

  tags = {
    Name               = "${var.environment}-knowledge-content-storage"
    Environment        = var.environment
    Purpose           = "Content storage for knowledge aggregation system"
    SecurityLevel     = "Sensitive"
    DataClassification = "Internal"
    ManagedBy         = "terraform"
  }
}

# Content Storage Bucket Versioning
resource "aws_s3_bucket_versioning" "content_storage_versioning" {
  bucket = aws_s3_bucket.content_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Content Storage Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "content_storage_encryption" {
  bucket = aws_s3_bucket.content_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Content Storage Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "content_storage_access" {
  bucket = aws_s3_bucket.content_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Content Storage Bucket Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "content_storage_lifecycle" {
  bucket = aws_s3_bucket.content_storage.id

  rule {
    id     = "archive_old_content"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 180
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Exports Bucket
resource "aws_s3_bucket" "exports" {
  bucket = "${var.environment}-knowledge-exports"
  # Allow destruction as exports are temporary
  force_destroy = true

  tags = {
    Name               = "${var.environment}-knowledge-exports"
    Environment        = var.environment
    Purpose           = "Export storage for generated documents"
    SecurityLevel     = "Internal"
    DataClassification = "Public"
    ManagedBy         = "terraform"
  }
}

# Exports Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "exports_encryption" {
  bucket = aws_s3_bucket.exports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Exports Bucket Lifecycle Rules
resource "aws_s3_bucket_lifecycle_configuration" "exports_lifecycle" {
  bucket = aws_s3_bucket.exports.id

  rule {
    id     = "cleanup_old_exports"
    status = "Enabled"

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 30
    }
  }
}

# Exports Bucket CORS Configuration
resource "aws_s3_bucket_cors_configuration" "exports_cors" {
  bucket = aws_s3_bucket.exports.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Exports Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "exports_access" {
  bucket = aws_s3_bucket.exports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Output values for reference in other resources
output "content_bucket_id" {
  description = "ID of the content storage bucket for reference in other resources"
  value       = aws_s3_bucket.content_storage.id
}

output "content_bucket_arn" {
  description = "ARN of the content storage bucket for IAM policy configuration"
  value       = aws_s3_bucket.content_storage.arn
}

output "exports_bucket_id" {
  description = "ID of the exports bucket for reference in other resources"
  value       = aws_s3_bucket.exports.id
}

output "exports_bucket_arn" {
  description = "ARN of the exports bucket for IAM policy configuration"
  value       = aws_s3_bucket.exports.arn
}