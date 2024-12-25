# AWS CloudFront Configuration for Knowledge Aggregation System
# AWS Provider Version: ~> 5.0

# Origin Access Identity for secure S3 bucket access
resource "aws_cloudfront_origin_access_identity" "content_oai" {
  comment = "${var.environment} knowledge content OAI"
}

# Security Headers Policy for enhanced security
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${var.environment}-security-headers"
  comment = "Security headers policy for ${var.environment} environment"

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; img-src 'self' data:; script-src 'self'"
      override = true
    }
    
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains        = true
      preload                  = true
      override                 = true
    }
    
    content_type_options {
      override = true
    }
    
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    
    xss_protection {
      mode_block = true
      protection = true
      override  = true
    }
    
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
  }
}

# Main CloudFront Distribution
resource "aws_cloudfront_distribution" "content_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_All"
  comment             = "${var.environment} knowledge content distribution"
  default_root_object = "index.html"
  
  # Origin configuration for S3
  origin {
    domain_name = aws_s3_bucket.content_storage.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.content_storage.id}"
    
    origin_shield {
      enabled              = true
      origin_shield_region = var.aws_region
    }
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.content_oai.cloudfront_access_identity_path
    }
  }
  
  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.content_storage.id}"
    compress         = true
    
    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy     = "redirect-to-https"
    min_ttl                   = 0
    default_ttl               = 86400    # 24 hours
    max_ttl                   = 604800   # 7 days
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }
  
  # Custom error responses
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 10
  }
  
  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 10
  }
  
  # Access restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  # SSL/TLS configuration
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method            = "sni-only"
  }
  
  # Tags
  tags = {
    Name        = "${var.environment}-knowledge-cdn"
    Environment = var.environment
    Service     = "knowledge-platform"
    ManagedBy   = "terraform"
  }
}

# Outputs for reference in other resources
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.content_distribution.id
}

output "cloudfront_distribution_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.content_distribution.domain_name
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.content_distribution.arn
}