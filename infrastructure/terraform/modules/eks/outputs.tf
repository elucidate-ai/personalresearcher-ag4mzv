# Output definitions for the AWS EKS cluster module
# terraform >= 1.6.0 required
# aws provider ~> 5.0
# kubernetes provider ~> 2.23

output "cluster_id" {
  description = "The unique identifier of the EKS cluster used for resource tagging and API operations"
  value       = aws_eks_cluster.main.id
}

output "cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server used for kubectl and other API operations"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required for secure cluster authentication and API communication"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster control plane for network access control"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "node_groups" {
  description = "Map of all EKS node groups with their configurations including instance types, scaling settings, and labels"
  value       = aws_eks_node_group.main
}

output "cluster_iam_role_arn" {
  description = "ARN of the IAM role used by the EKS cluster for service integrations and permissions"
  value       = aws_eks_cluster.main.role_arn
}