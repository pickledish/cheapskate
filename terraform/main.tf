resource "supabase_project" "cheapskate" {
  organization_id   = var.supabase_organization_id
  name              = var.project_name
  database_password = var.supabase_db_password
  region            = var.region

  lifecycle {
    ignore_changes = [database_password]
  }
}

resource "supabase_settings" "cheapskate" {
  project_ref = supabase_project.cheapskate.id

  api = jsonencode({
    db_schema            = "public"
    db_extra_search_path = "public,extensions"
    max_rows             = 1000
  })
}

data "supabase_apikeys" "cheapskate" {
  project_ref = supabase_project.cheapskate.id
}
