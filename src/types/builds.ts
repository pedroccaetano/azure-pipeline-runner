type PipelineById = {
  count: number;
  value: Build[];
};

type Build = {
  _links: Links;
  properties: Record<string, unknown>;
  tags: string[];
  validationResults: unknown[];
  plans: Plan[];
  triggerInfo: TriggerInfo;
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  queueTime: string;
  startTime: string;
  finishTime: string;
  url: string;
  definition: Definition;
  project: Project;
  uri: string;
  sourceBranch: string;
  sourceVersion: string;
  queue: Queue;
  priority: string;
  reason: string;
  requestedFor: RequestedFor;
  requestedBy: RequestedBy;
  lastChangedDate: string;
  lastChangedBy: RequestedBy;
  orchestrationPlan: Plan;
  logs: Logs;
  repository: Repository;
  retainedByRelease: boolean;
  triggeredByBuild: unknown;
  appendCommitMessageToRunName: boolean;
  commitMessage?: string;
  keepForever?: boolean;
  retentionLeases?: RetentionLease[];
};

type RetentionLease = {
  leaseId: number;
  ownerId: string;
  createdDate: string;
  protectPipeline: boolean;
  runId: number;
};

type Links = {
  self: Link;
  web: Link;
  sourceVersionDisplayUri: Link;
  timeline: Link;
  badge: Link;
};

type Link = {
  href: string;
};

type Plan = {
  planId: string;
};

type TriggerInfo = {
  "ci.sourceBranch": string;
  "ci.sourceSha": string;
  "ci.message": string;
  "ci.triggerRepository": string;
};

type Definition = {
  drafts: unknown[];
  id: number;
  name: string;
  url: string;
  uri: string;
  path: string;
  type: string;
  queueStatus: string;
  revision: number;
  project: Project;
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
};

type Queue = {
  id: number;
  name: string;
  pool: Pool;
};

type Pool = {
  id: number;
  name: string;
  isHosted: boolean;
};

type RequestedFor = {
  displayName: string;
  url: string;
  _links: AvatarLink;
  id: string;
  uniqueName: string;
  imageUrl: string;
  descriptor: string;
};

type RequestedBy = {
  displayName: string;
  url: string;
  _links: AvatarLink;
  id: string;
  uniqueName: string;
  imageUrl: string;
  descriptor: string;
};

type AvatarLink = {
  avatar: Link;
};

type Logs = {
  id: number;
  type: string;
  url: string;
};

type Repository = {
  id: string;
  type: string;
  name: string;
  url: string;
  clean: unknown;
  checkoutSubmodules: boolean;
};



export { PipelineById, Build, RetentionLease };
