
## [0.0.54]

### Update

- Added documentation link for built-in: terraform_remote_state



## [0.0.53]

### Update

- Deleted official-provider [hashicorp/terraform](https://github.com/hashicorp/terraform-provider-terraform)

## [0.0.52]

### Update

- Add new partner-provider [jfrog/platform](https://github.com/jfrog/terraform-provider-platform)
- Deleted partner-provider [vmware/for-vmware-nsxt-virtual-private-cloud](https://github.com/vmware/terraform-provider-for-vmware-nsxt-virtual-private-cloud)


## [0.0.51]

### Update

- Removed fly-apps/fly partner status

## [0.0.50]

### Improvements

- Added documentation links to all basic-blocks for any new-comers, such as variables, outputs, resources, etc.

### Update

- Add new partner-provider [vmware/for-vmware-nsxt-virtual-private-cloud](https://registry.terraform.io/providers/vmware/for-vmware-nsxt-virtual-private-cloud/latest/docs)
- Add new partner-provider [vmware/nsxt-virtual-private-cloud](https://registry.terraform.io/providers/vmware/nsxt-virtual-private-cloud/latest/docs)
- Add new partner-provider [NetApp/netapp-ontap](https://registry.terraform.io/providers/netapp/netapp-ontap/latest/docs)


## [0.0.49]

### Update

- Add new partner-provider  [accuknox/accuknox](https://registry.terraform.io/providers/accuknox/accuknox/latest)
- Add new partner-provider  [citrix/citrix](https://registry.terraform.io/providers/citrix/citrix/latest)
- Add new partner-provider  [PrefectHQ/prefect](https://registry.terraform.io/providers/PrefectHQ/prefect/latest)

## [0.0.48]

### Update

- Add new partner-provider [Azure/modtm](https://registry.terraform.io/providers/Azure/modtm/latest)
  

## [0.0.47]

### Update

- Add new partner-provider [PaloAltoNetworks/prismacloud-waas](https://registry.terraform.io/providers/PaloAltoNetworks/prismacloud/latest)


## [0.0.46]

### Fix

- Fix missing link when hovering over data-sources.


## [0.0.45]

### Improvement

- Add error handling for misspelled required providers


## [0.0.44]

### Update

- Add new partner-provider [cloudera/cdp](https://registry.terraform.io/providers/cloudera/cdp/latest/docs)
- Add new partner-provider [CiscoDevNet/ise](https://registry.terraform.io/providers/CiscoDevNet/ise/latest/docs)
- Add new partner-provider [Venafi/venafi-token](https://registry.terraform.io/providers/venafi/venafi-token/latest/docs)


## [0.0.43]

### Update

- Add new partner-provider [dell/powerscale](https://registry.terraform.io/providers/dell/powerscale/latest/docs)
- Add new partner-provider [dell/redfish](https://registry.terraform.io/providers/dell/redfish/latest/docs)
- Add new partner-provider [vantage-sh/vantage](https://registry.terraform.io/providers/vantage-sh/vantage/latest/docs)

  
## [0.0.42]

### Update

- Add new partner-provider ['barracudanetworks/barracudawaf'](https://registry.terraform.io/providers/barracudanetworks/barracudawaf/latest/docs)
  

## [0.0.41]

### Fix

- Sharp installation issues
- Error handling for sharp


## [0.0.40]

### Fix

- Temporarily disable logo support for non-offical providers, due to crashes
  
## [0.0.39]

### Fix

- Add missing dependency
  
## [0.0.38]

### Features

- Add logo support for non-offical providers

## [0.0.37]

### Updates

- Add new partner-provider 'kestra-io/kestra'

## [0.0.36]

### Features

- Fix issue with triple resource entries, du to terraform mulit-language docs
- Replaced all logos with a more compressed version

## [0.0.35]

### Features

- Display icons for offical and partner providers
- Added further cli documentations
  
## [0.0.34]

### Features

- Added terraform test documentation
  

## [0.0.33]

### Improvements

- Added buttons to ui
- Button to refresh provider view
  
## [0.0.32]

### Improvements

- Add terraform_remote_state to documentations
  
## [0.0.31]

### Improvements

- Restructure terraform documentations

## [0.0.30]

### Fix

- Fix error with 'Terraform Providers'-View when using multiple root-folders in workspace
  

## [0.0.29]

### Improvements

- Always show 'terraform' in Provider-View, regardless if 'required_version' is defined.


## [0.0.28]

### Feature

- added documentation for new feature from terraform 1.5.0: Check Blocks
- added documentation for new feature from terraform 1.5.0: Import Blocks
- added documentation for new feature from terraform 1.5.0: Generate Configurations
- add documentatio for Moved Blocks
  
## [0.0.27]

### Feature

- added documentation for new function from terraform 1.5.0: strcontains
- added documentation for new function from terraform 1.5.0: plantimestamp 

## [0.0.26]

### Fix

- fix errors in documentation
  
## [0.0.25]

### Fix

- fix broken function links

## [0.0.24]

### Improvments

- Added documentations for local-exec, remote-exec, file-provsioners
- Additional Documentation now also accesible via 'Terraform Provider'-View.
  
## [0.0.23]

### Fix

- Fixed extension crashes due to filepath issues on linux

## [0.0.22]

### Fix

- Fixed issue with missing highlighting of Terraform-Extension from Anton Kulikov, due to conflicting language contributions


## [0.0.21]

### Improvements

- removed obsolete Settings
- optimised providerview feature
- show required terraform version on providerview

## [0.0.20]

### Feature

- Add view for providers in current configuration
  
## [0.0.19]

### Fixed

- fix null being ignored when parsin providers

## [0.0.18]

### Improvements

- Support hover for built-in resource: `terraform_data`

## [0.0.17]

### Feature

- optional support for other module sources

## [0.0.16]

### Fixed

- fixed error with certain module sources

## [0.0.15]

### Fixed

- fixed error with settings

## [0.0.14]

### Feature

- Queries terraform 'required_providers'-block for source and version
- Providers that are defined there, will be found regardles if they are partner or official providers
- Setting to ignore set provider version in 'required_providers'-block
- `Terraform Quick Docs: Show Resource Documentation` shows providers in configuration as top of the list
- `Terraform Quick Docs: Show supported Providers` shows providers in configuration as top of the list

## [0.0.13]

### Improvements

- Tweaks to the function documentations

## [0.0.12]

### Feature

- Added hover support for terraform functions
- Added commands to open terraform functions docs and addtional docs

## [0.0.11]

### Improvements

- Add filecaching on API-Calls

## [0.0.10]

### Feature

- Add Command for opening any Resource Documentation

## [0.0.9]

### Improvements

- Change getProviders API to use v2 with more options
- Read providers list from static JSON, instead of calling API on each start of language server.

## [0.0.8]

### Fixed

- Fix errors with previous implementation

## [0.0.7]

### Feature

- Open Documentation for inline elements, such as 'data.<data_source>', '<resource_identifer>.<resource_name>'

## [0.0.6]

### Feature

- Settings to add support for more than the default Providers

## [0.0.5]

### Feature

- Add functionality for opening modules in the terraform registry

## [0.0.4]

### Feature

- Add a simple icon

## [0.0.3]

### Fixed

- terraform api doesn't return azure/azapi as a verified provider

## [0.0.2]

### Fixed

- Update Changelog and Readme to released

## [0.0.1]

### Feature

- Initial release with basic functionality