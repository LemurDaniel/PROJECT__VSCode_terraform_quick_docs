
##########################################################################
###########   Setting up Schedule time, encoding, rotation   #############
##########################################################################

locals {
  # is_assignment_permanent = can(regex("^(permanent)|(\\d+ *days{0,1})|(\\d+ *years)$", lower(var.assignment_schedule)))
  is_assignment_permanent = lower(var.assignment_schedule) == "permanent"
  is_assignment_disabled  = lower(var.assignment_schedule) == "disabled"
  is_assignment_scheduled = local.is_assignment_permanent == false && local.is_assignment_disabled == false ## Neither permaanent nor disabled

  assignment_duration_value = local.is_assignment_scheduled ? coalesce(regex("(\\d+[.]\\d+)|(\\d+)", lower(var.assignment_schedule))...) : 365000 # regex filter out int, or float | else set to 1000 years.
  assignment_duration_type  = local.is_assignment_scheduled ? coalesce(regex("(day)|(month)|(year)", lower(var.assignment_schedule))...) : "day"
  assignment_duration_days = {
    year  = floor(local.assignment_duration_value * 365)
    month = floor(local.assignment_duration_value * 30)
    day   = floor(local.assignment_duration_value)
  }

  assignment_duration_encoded = "P${local.assignment_duration_days[local.assignment_duration_type]}D"

  start_date_time = "${formatdate("YYYY-MM-DD", time_rotating.schedule_request_start_date.id)}T${formatdate("HH:mm:ss.0000000+02:00", time_rotating.schedule_request_start_date.id)}"
}

## Used to a) support short life time assignments automatically re-assigned and b) support a single start date that does not change
resource "time_rotating" "schedule_request_start_date" {
  rotation_days = local.assignment_duration_days[local.assignment_duration_type] # floor(var.pim_config.eligible_assignment_expiration / 2)
}



##########################################################################
###########        Setting up Scopes, current scope          #############
##########################################################################

# Try getting subscription_name when scope is subsription
locals {

  possible_scopes = {
    management_group = {
      is_scope = can(regex("^/managementgroups/[^/]+$", lower(var.assignment_scope)))
      name     = split("/", var.assignment_scope)[length(split("/", var.assignment_scope)) - 1]
      full     = format("/providers/Microsoft.Management%s", var.assignment_scope)
      type     = "mgmt"
    }
    subscription = {
      is_scope = can(regex("^/subscriptions/[^/]+$", lower(var.assignment_scope)))
      name     = can(regex("\\d{4}", var.assignment_scope_name)) ? regex("\\d{4}", var.assignment_scope_name) : "NULL"
      full     = format("/providers/Microsoft.Subscription%s", var.assignment_scope)
      type     = "subs"
    }
    resource_group = {
      is_scope = can(regex("^/subscriptions/[^/]+/resourcegroups/[^/]+$", lower(var.assignment_scope)))
      name     = split("/", var.assignment_scope)[length(split("/", var.assignment_scope)) - 1]
      full     = format("/providers/Microsoft.Subscription%s", var.assignment_scope)
      type     = "rg"
    }
    resources = {
      is_scope = can(regex("^/subscriptions/[^/]+/resourcegroups/[^/]+/providers/[^/]+/[^/]+/[^/]+$", lower(var.assignment_scope)))
      name     = split("/", var.assignment_scope)[length(split("/", var.assignment_scope)) - 1]
      full     = format("/providers/Microsoft.Subscription%s", var.assignment_scope)
      type     = "res"
    }
  }

  current_scope = [
    for scope_data in local.possible_scopes :
    scope_data
    if scope_data.is_scope
  ][0]

}

##########################################################################
###########               Setting up AD Group                #############
##########################################################################

locals {

  ad_group_description = {
    eligible = "PIM Group for the RBAC-Role '${var.role_definition_name}' on Scope ${local.current_scope.type} - ${local.current_scope.name}. All Members will be of ${var.schedule_type}-Assignment in PIM, requiring an action to activate the role. Managed by Azure Cloud Foundation."
    active   = "PIM Group for the RBAC-Role '${var.role_definition_name}' on Scope ${local.current_scope.type} - ${local.current_scope.name}. All Members will be of ${var.schedule_type}-Assignment in PIM, requiring no action to activate the role. Managed by Azure Cloud Foundation."
  }
}


# Create Azure AD Group for Eligible or Active PIM-Assignments
resource "azuread_group" "pim_assignment_ad_group_base" {
  display_name     = format("acf_pimv3_%s_%s_%s_%s__BASE", local.current_scope.type, local.current_scope.name, var.assignment_name, var.schedule_type)
  mail_enabled     = false
  security_enabled = true
  description      = "Do not assing Members! Manual assigned Members will be removed! -- ${local.ad_group_description[var.schedule_type]}"

  owners = var.aad_group_owner_ids

  dynamic "testing_testing" {
    for_each = {}

    content {

    }
  }

}

# Create Azure AD Group for Eligible or Active Assignments with ignored Memeber lifecycle (For example for outside management via Access Packages)

resource "azuread_group" "pim_assignment_ad_group_ignore_lifecycle" {
  count = var.enable_manual_member_group ? 1 : 0

  display_name     = format("acf_pimv3_%s_%s_%s_%s__ExternalManaged", local.current_scope.type, local.current_scope.name, var.assignment_name, var.schedule_type)
  mail_enabled     = false
  security_enabled = true
  description      = "Group memberships can be managed externally managed. -- ${local.ad_group_description[var.schedule_type]}"

  owners = var.aad_group_owner_ids

  lifecycle {
    ignore_changes = [
      members
    ]
  }
}

resource "azuread_group_member" "pim_assignment_ad_group_ignore_lifecycle" {
  count = var.enable_manual_member_group ? 1 : 0

  group_object_id  = azuread_group.pim_assignment_ad_group_base.id
  member_object_id = azuread_group.pim_assignment_ad_group_ignore_lifecycle[0].id
}


# Add to access packages

resource "azuread_access_package_resource_catalog_association" "catalog_association" {
  count = var.enable_manual_member_group && var.acf_foundation_access_package_catalog != null ? 1 : 0

  catalog_id             = var.acf_foundation_access_package_catalog.id
  resource_origin_id     = azuread_group.pim_assignment_ad_group_ignore_lifecycle[0].id
  resource_origin_system = "AadGroup"
}

resource "azuread_access_package_resource_package_association" "access_package_association" {
  for_each = var.enable_manual_member_group && var.acf_foundation_access_package_catalog != null ? var.access_packages : []

  access_package_id               = var.acf_foundation_access_package_catalog.access_packages[each.value].id
  catalog_resource_association_id = azuread_access_package_resource_catalog_association.catalog_association[0].id
}

# Assign Members to PIM-AD-Group via Terraform.
data "azuread_user" "assignment_group_members" {
  for_each = toset([
    for member in var.assignment_group_members :
    member if length(regexall("^.+@.+[.].+$", lower(member))) > 0 && length(regexall("^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$", member)) == 0
  ])

  //mail_nickname = each.key
  user_principal_name = each.key
}

resource "azuread_group_member" "assignment_group_members_upns" {
  for_each = data.azuread_user.assignment_group_members

  group_object_id  = azuread_group.pim_assignment_ad_group_base.id
  member_object_id = each.value.id
}

# Query members groups IDs defined as groups owners in JSON file
data "azuread_group" "assignment_group_members" {
  for_each = toset([
    for member in var.assignment_group_members :
    member if length(regexall("^.+@.+[.].+$", lower(member))) == 0 && length(regexall("^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$", member)) == 0
  ])

  display_name = each.key
}
resource "azuread_group_member" "assignment_group_members_groups" {
  for_each = data.azuread_group.assignment_group_members

  group_object_id  = azuread_group.pim_assignment_ad_group_base.id
  member_object_id = each.value.id
}

resource "azuread_group_member" "assignment_group_members_object_ids" {
  for_each = toset([
    for member in var.assignment_group_members :
    member
    if length(regexall("^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$", member)) > 0
  ])

  group_object_id  = azuread_group.pim_assignment_ad_group_base.id
  member_object_id = each.value
}

