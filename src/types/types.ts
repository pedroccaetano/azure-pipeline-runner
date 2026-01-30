type PipelineLink = {
  href: string;
};

type PipelineLinks = {
  self: PipelineLink;
  web: PipelineLink;
};

type Pipeline = {
  _links: PipelineLinks;
  url: string;
  id: number;
  revision: number;
  name: string;
  folder: string;
};

type PipelinesResponse = {
  count: number;
  value: Pipeline[];
};

type Project = {
  id: string;
  name: string;
  description: string;
  url: string;
  state: string;
  revision: number;
  visibility: string;
  lastUpdateTime: string;
  avatarUrl?: string;
};

type ProjectsResponse = {
  count: number;
  value: Project[];
};

type PipelineParameter = {
  name: string;
  displayName?: string;
  type?: string;
  default?: string;
  values?: string[];
};

type PipelineConfiguration = {
  path: string;
  repository?: {
    id: string;
    type: string;
  };
  type: string;
};

type PipelineDefinition = {
  configuration: PipelineConfiguration;
  id: number;
  name: string;
  folder: string;
  revision: number;
  url: string;
  _links: PipelineLinks;
};

type TemplateParameters = {
  [key: string]: string;
};

export {
  Pipeline,
  PipelinesResponse,
  Project,
  ProjectsResponse,
  PipelineParameter,
  PipelineDefinition,
  TemplateParameters,
};
