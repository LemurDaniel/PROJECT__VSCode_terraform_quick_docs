# Change Log

All notable changes to the "terraform-quick-docs" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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