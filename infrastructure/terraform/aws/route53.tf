# AWS Provider configuration with Route53 permissions
# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary hosted zone for the knowledge curator domain
resource "aws_route53_zone" "main" {
  name          = "knowledge-curator.com"
  comment       = "Main hosted zone for Knowledge Curator application with global routing"
  force_destroy = false

  tags = {
    Name        = "knowledge-curator-zone"
    Environment = var.environment
    Service     = "dns"
    ManagedBy   = "terraform"
    CostCenter  = "infrastructure"
  }
}

# A record for web application with CloudFront distribution
resource "aws_route53_record" "app_ipv4" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.knowledge-curator.com"
  type    = "A"

  alias {
    name                   = var.cdn_domain_name
    zone_id               = "Z2FDTNDATAQYW2" # CloudFront's hosted zone ID
    evaluate_target_health = true
  }
}

# AAAA record for web application with IPv6 support
resource "aws_route53_record" "app_ipv6" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.knowledge-curator.com"
  type    = "AAAA"

  alias {
    name                   = var.cdn_domain_name
    zone_id               = "Z2FDTNDATAQYW2" # CloudFront's hosted zone ID
    evaluate_target_health = true
  }
}

# Health check endpoint record pointing to ALB
resource "aws_route53_record" "health" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "health.knowledge-curator.com"
  type    = "CNAME"
  ttl     = 60
  records = [aws_lb.main.dns_name]
}

# Enhanced health check configuration for the application
resource "aws_route53_health_check" "app_health" {
  fqdn              = "health.knowledge-curator.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"
  
  regions = [
    "us-east-1",    # N. Virginia
    "eu-west-1",    # Ireland
    "ap-southeast-1" # Singapore
  ]

  enable_sni         = true
  search_string      = "\"status\":\"healthy\""
  measure_latency    = true
  invert_healthcheck = false
  disabled          = false

  tags = {
    Name        = "web-health-check"
    Environment = var.environment
    Service     = "monitoring"
    ManagedBy   = "terraform"
  }
}

# Output the Route53 zone ID for reference
output "route53_zone_id" {
  description = "The Route53 zone ID for DNS record management"
  value       = aws_route53_zone.main.zone_id
}

# Output the Route53 nameservers for domain configuration
output "route53_name_servers" {
  description = "The Route53 zone nameservers for domain configuration"
  value       = aws_route53_zone.main.name_servers
}

# Output the health check ID for monitoring configuration
output "health_check_id" {
  description = "The Route53 health check ID for monitoring configuration"
  value       = aws_route53_health_check.app_health.id
}