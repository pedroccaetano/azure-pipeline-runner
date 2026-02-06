# Change Log

All notable changes to the "Azure Pipelines Runner" extension will be documented in this file.

## [0.2.0]

- Major feature enhancements [#23](https://github.com/pedroccaetano/azure-pipeline-runner/pull/23) by @JtMotoX
  - **Stage Approvals**: Approve or reject stages awaiting approval with interactive prompts
  - **Stage Retry**: Retry failed stages with options to rerun failed or all jobs
  - **Build Retention**: Retain builds indefinitely or remove retention with clear status indicators
  - **Builds Pagination**: Configurable build loading per page for better performance
  - **GitHub Repository Support**: Full support for Azure Pipelines stored in GitHub repositories
  - UI improvements: loading states, updated icons, and better visual clarity
  - Fixed nested folder support in pipeline tree (unlimited depth)

## [0.1.0]

- **Filter Pipelines by Project** feature for better project management
  - Filter view to show only selected projects
  - Persistent filter across sessions
  - Improved icons using native VSCode theme icons
- Added **Delete Build** functionality to remove builds directly from the extension
- Added **Cancel Build** functionality to stop in-progress or queued builds

## [0.0.9]

- Auto-refresh polling with configurable settings and status bar control [#22](https://github.com/pedroccaetano/azure-pipeline-runner/pull/22) by @JtMotoX
  - Introduced configurable polling for builds and stages with automatic refresh
  - Added status bar toggle to enable/disable polling
  - Implemented configurable polling interval (1-60 seconds, default: 5 seconds)
  - Polling pauses/resumes based on view visibility for better performance

## [0.0.8]

- Multi-account support with secure credential storage [#20](https://github.com/pedroccaetano/azure-pipeline-runner/pull/20) by @JtMotoX
- Configurable log viewer options (Output Channel or File) [#21](https://github.com/pedroccaetano/azure-pipeline-runner/pull/21)

## [0.0.7]

- Trigger pipeline runs and retrigger builds from VS Code [#19](https://github.com/pedroccaetano/azure-pipeline-runner/pull/19) by @JtMotoX

## [0.0.6]

- Sort projects and pipelines for better organization [#18](https://github.com/pedroccaetano/azure-pipeline-runner/pull/18) by @JtMotoX

## [0.0.5] 

- Enhanced README with a more detailed description and an illustrative demo GIF.
- Improved stage log output formatting by removing timestamps for better readability.

## [0.0.4]

- Display Build Stages and add stage Log [#10](https://github.com/pedroccaetano/azure-pipeline-runner/pull/11)
  - Introduced a dedicated view for displaying pipeline stages.
  - Added an icon to easily open the Azure Pipeline log inside VS Code.

## [0.0.3]

- Create a view for displaying Builds from pipelines [#5](https://github.com/pedroccaetano/azure-pipeline-runner/issues/5)
  - Introduced a dedicated view for displaying pipeline builds.
  - Added functionality to load more builds and refresh the view to get the latest builds.
- Add in-progress builds icon and improve duration display text [#9](https://github.com/pedroccaetano/azure-pipeline-runner/issues/9)

## [0.0.2]

- Added a refresh button next to the title in the extension to allow users to easily refresh the extension. [#2](https://github.com/pedroccaetano/azure-pipeline-runner/issues/2)

## [0.0.1]

- Initial release of the extension with basic listing and viewing functionalities for pipelines and builds.
