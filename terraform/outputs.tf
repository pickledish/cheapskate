output "project_id" {
  description = "The Supabase project reference ID"
  value       = supabase_project.cheapskate.id
}

output "project_url" {
  description = "The Supabase project URL"
  value       = "https://${supabase_project.cheapskate.id}.supabase.co"
}

output "anon_key" {
  description = "The anonymous API key for client-side access"
  value       = data.supabase_apikeys.cheapskate.anon_key
  sensitive   = true
}

output "service_role_key" {
  description = "The service role key for server-side access (admin)"
  value       = data.supabase_apikeys.cheapskate.service_role_key
  sensitive   = true
}
