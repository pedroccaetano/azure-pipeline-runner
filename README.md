# Azure Pipelines Runner

Azure Pipelines Runner is a Visual Studio Code extension that allows you to interact with your Azure DevOps pipelines and builds directly from the editor. This extension provides a convenient way to manage and monitor your CI/CD workflows without leaving your development environment.

> **Disclaimer:** This extension works only with Azure DevOps Services (cloud) and not with Azure DevOps Server (on-premises).

## Features

![Azure Pipelines Runner Demo](./resources/demo.gif)

1. **List Azure DevOps Projects**: View all available projects in your Azure DevOps organization.
2. **List Pipelines in Each Project**: Navigate through the pipelines configured in each project.
3. **List Builds in Each Pipeline**: See all builds associated with a specific pipeline.
4. **View Build Details**: Access detailed information about each build, including logs and status.
5. **Open Pipelines and Builds in Browser**: Quickly access the Azure DevOps web interface for any pipeline or build.
6. **Display Build Stages and Logs**: View the build execution stages and access logs directly in VS Code.

## Requirements

- Azure DevOps organization name.
- Personal Access Token (PAT) with the following permissions:
  - Build (Read & Execute)
  - Code (Read)
  - Release (Read, Write, Execute, & Manage)

## Extension Settings

This extension contributes the following settings:

- `azurePipelinesRunner.organization`: Azure DevOps organization name.
- `azurePipelinesRunner.pat`: Personal Access Token (PAT) for Azure DevOps.

```json
{
  "azurePipelinesRunner.organization": "project-test",
  "azurePipelinesRunner.pat": "000000000"
}
```

## Todo

For more detailed project management, tracking, and planning, you can visit the project board on GitHub. This board provides an overview of the current tasks, progress, and future plans for the Azure Pipelines Runner extension.

[Project Board](https://github.com/users/pedroccaetano/projects/2)

## Collaboration

I welcome contributions from the community! If you have any ideas, suggestions, or bug reports, please feel free to open an issue on GitHub. If you would like to contribute code, you can fork the repository, make your changes, and create a pull request.

Feel free to contact us if you have any questions or need assistance. I appreciate your feedback and contributions!

## Release Notes

### 0.0.5

- Enhanced README with a more detailed description and an illustrative demo GIF.
- Improved stage log output formatting by removing timestamps for better readability.

### 0.0.4

- Display Build Stages and add stage Log [#10](https://github.com/pedroccaetano/azure-pipeline-runner/pull/11)
  - Introduced a dedicated view for displaying pipeline stages.
  - Added an icon to easily open the Azure Pipeline log inside VS Code.

### 0.0.3

- Create a view for displaying Builds from pipelines [#5](https://github.com/pedroccaetano/azure-pipeline-runner/issues/5)
  - Introduced a dedicated view for displaying pipeline builds.
  - Added functionality to load more builds and refresh the view to get the latest builds.
- Add in-progress builds icon and improve duration display text [#9](https://github.com/pedroccaetano/azure-pipeline-runner/issues/9)

### 0.0.2

- Added a refresh button next to the title in the extension to allow users to easily refresh the extension. [#2](https://github.com/pedroccaetano/azure-pipeline-runner/issues/2)

### 0.0.1

- Initial release of the extension with basic listing and viewing functionalities for pipelines and builds.
