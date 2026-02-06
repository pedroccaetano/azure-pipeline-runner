export interface BuildTimeline {
  records: TimelineRecord[];
  lastChangedBy: string;
  lastChangedOn: string;
  id: string;
  changeId: number;
  url: string;
}

export interface TimelineRecord {
  previousAttempts: any[];
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  startTime: string | null;
  finishTime: string | null;
  currentOperation: string | null;
  percentComplete: number | null;
  state: string;
  result: string;
  resultCode: string | null;
  changeId: number;
  lastModified: string;
  workerName: string | null;
  details: string | null;
  errorCount: number;
  warningCount: number;
  url: string | null;
  log: Log | null;
  task: Task | null;
  attempt: number;
  identifier: string | null;
  issues?: Issue[];
  order?: number;

  // Custom properties
  buildId: number;
  projectName: string;
}

export interface Log {
  id: number;
  type: string;
  url: string;
}

export interface Task {
  id: string;
  name: string;
  version: string;
}

export interface Issue {
  type: string;
  category: string | null;
  message: string;
  data: { [key: string]: string };
}

export type StageRetryMethod = 
  | 'build-level-retry'      // Retry failed jobs at build level
  | 'stage-level-retry'      // Retry stage (for checkpoint failures)
  | 'stage-level-rerun';     // Rerun completed stage

export interface StageRetryDecision {
  method: StageRetryMethod;
  stageIdentifier?: string;  // Required for stage-level operations
  buildId: number;
  projectName: string;
}
