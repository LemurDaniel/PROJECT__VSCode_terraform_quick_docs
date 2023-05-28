# Change Log

All notable changes to the "terraform-quick-docs" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.1]

- Initial release with basic functionality


## [0.0.2]

- Update Changelog and Readme to released

## [0.0.3]

- fix: terraform api doesn't return azure/azapi as a verified provider

## [0.0.4]

- Add a simple icon

## [0.0.5]

- Add functionality for opening modules in the terraform registry

## [0.0.6]

- Settings to add support for more than the default Providers

## [0.0.7]

- Open Documentation for inline elements, such as 'data.<data_source>', '<resource_identifer>.<resource_name>'

## [0.0.8]

- Fix errors with previous implementation

## [0.0.9]

- Change getProviders API to use v2 with more options
- Read providers list from static JSON, instead of calling API on each start of language server.

## [0.0.10]

- Add Command for opening any Resource Documentation

## [0.0.11]

- Add filecaching on API-Calls

## [0.0.12]

- Added hover support for terraform functions
- Added commands to open terraform functions docs and addtional docs

## [0.0.13]

- Tweaks to the function documentations

## [0.0.14]

- Queries terraform 'required_providers'-block for source and version
- Providers that are defined there, will be found regardles if they are partner or official providers
- Setting to ignore set provider version in 'required_providers'-block
- `Terraform Quick Docs: Show Resource Documentation` shows providers in configuration as top of the list
- `Terraform Quick Docs: Show supported Providers` shows providers in configuration as top of the list

## [0.0.15]

- fixed error with settings