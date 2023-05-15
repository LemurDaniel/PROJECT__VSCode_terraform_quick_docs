resource "azurerm_network_interface" "vm_mgmt_nic" {
  name                = module.nic_mgmt_naming.name
  location            = var.location
  resource_group_name = var.resource_group_name

  dynamic "testing_testing" {
    for_each = {}

    content {
      something   = null
      blabla_test = null

      dynamic "testing_testing" {
        for_each = {}

        content {
          something   = null
          blabla_test = null
        }
      }

    }
  }
  
  ip_configuration {

    
    name                          = "primary"
    subnet_id                     = lookup(var.acf_hub_virtual_network_subnets, "subnet_bip_mgmt").id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = module.bigip_mgmt_pip.id
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [
      tags["govAccountable"],
      tags["govResponsible"],
      tags["govExternalResponsible"],
      tags["govBusinessCriticality"],
      tags["govBilling"],
      tags["govCompany"],
      tags["govCostCenter"],
      tags["govWorkloadDescription"],
      tags["govWorkloadName"],
      tags["govEnvironment"],
    ]
  }
}
