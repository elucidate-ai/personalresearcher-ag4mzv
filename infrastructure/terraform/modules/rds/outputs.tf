# Primary cluster endpoint output
output "cluster_endpoint" {
  description = "Primary endpoint for DocumentDB cluster writer instance, used for write operations and primary instance access in the multi-AZ deployment"
  value       = aws_docdb_cluster.main.endpoint
}

# Reader endpoint output
output "reader_endpoint" {
  description = "Load-balanced reader endpoint for distributing read operations across available replica instances in the multi-AZ deployment"
  value       = aws_docdb_cluster.main.reader_endpoint
}

# List of all cluster instance endpoints
output "cluster_instances" {
  description = "List of all cluster instance endpoints for direct access, monitoring, and failover management in the high-availability setup"
  value       = aws_docdb_cluster_instance.main[*].endpoint
}

# List of cluster instance identifiers
output "cluster_instance_ids" {
  description = "List of cluster instance identifiers for monitoring, maintenance, and operational management"
  value       = aws_docdb_cluster_instance.main[*].identifier
}

# Cluster resource ID for monitoring
output "cluster_resource_id" {
  description = "The Resource ID of the DocumentDB cluster for CloudWatch monitoring and resource tagging"
  value       = aws_docdb_cluster.main.cluster_resource_id
}

# Security group ID
output "security_group_id" {
  description = "ID of the security group attached to the DocumentDB cluster for network access control and firewall configuration"
  value       = aws_security_group.docdb.id
}

# Port number
output "port" {
  description = "The port number on which the DocumentDB cluster accepts connections, required for client configuration"
  value       = aws_docdb_cluster.main.port
}