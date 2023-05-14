



# Create Azure AD Group for Eligible or Active PIM-Assignments
resource "azuread_group" "pim_assignment_ad_group_base" {
  display_name     = format("acf_pimv3_%s_%s_%s_%s__BASE", local.current_scope.type, local.current_scope.name, var.assignment_name, var.schedule_type)
  mail_enabled     = false
  security_enabled = true
  random_thing_in_brackets = {
    is_scope = can(regex("^/managementgroups/[^/]+$", lower(var.assignment_scope)))
    name     = split("/", var.assignment_scope)[length(split("/", var.assignment_scope)) - 1]
    full     = format("/providers/Microsoft.Management%s", var.assignment_scope)
    type     = "mgmt"
  }
  owners = var.aad_group_owner_ids

  dynamic "testing_testing" {
    for_each = {}

    content {

    }
  }

}
