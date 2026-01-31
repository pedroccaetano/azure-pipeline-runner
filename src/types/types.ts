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
  default?: unknown;
  values?: (string | number | boolean)[];
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

type TemplateParameterValue = string | number | boolean | object | TemplateParameterValue[];

type TemplateParameters = {
  [key: string]: TemplateParameterValue;
};

export {
  Pipeline,
  PipelinesResponse,
  Project,
  ProjectsResponse,
  PipelineParameter,
  PipelineDefinition,
  TemplateParameters,
  TemplateParameterValue,
};
