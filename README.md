# Azure Pipeline Runner

Azure Pipeline Runner is a Visual Studio Code extension that allows you to interact with your Azure DevOps pipelines and builds directly from the editor. This extension provides a convenient way to manage and monitor your CI/CD workflows without leaving your development environment.

> **Disclaimer:** This extension works only with Azure DevOps Services (cloud) and not with Azure DevOps Server (on-premises).

## Features

- List Azure DevOps projects.
- List pipelines within each project.
- List builds within each pipeline.
- View build details.
- Open pipelines and builds in the browser.

## Requirements

- Azure DevOps organization name.
- Personal Access Token (PAT) with the following permissions:
    - Build (Read & Execute)
    - Code (Read)
    - Release (Read, Write, Execute, & Manage)

## Extension Settings

This extension contributes the following settings:

- `azurePipelineRunner.organization`: Azure DevOps organization name.
- `azurePipelineRunner.pat`: Personal Access Token (PAT) for Azure DevOps.

## Known Issues

- Builds that are currently in progress are not listed.
- The command `azurePipelineRunner.refreshPipeline` is not implemented yet.
- The command `azurePipelineRunner.loadMoreBuilds` is not implemented yet.

## Release Notes

### 0.0.1

- Initial release of the extension with basic listing and viewing functionalities for pipelines and builds.
