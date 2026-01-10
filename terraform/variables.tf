variable "supabase_access_token" {
  description = "Supabase Personal Access Token (from Dashboard > Account > Access Tokens)"
  type        = string
  sensitive   = true
}

variable "supabase_organization_id" {
  description = "Supabase organization ID"
  type        = string
}

variable "supabase_db_password" {
  description = "Password for the Supabase project database"
  type        = string
  sensitive   = true
}

variable "project_name" {
  description = "Name of the Supabase project"
  type        = string
  default     = "cheapskate"
}

variable "region" {
  description = "Region for the Supabase project"
  type        = string
  default     = "us-west-1"
}
