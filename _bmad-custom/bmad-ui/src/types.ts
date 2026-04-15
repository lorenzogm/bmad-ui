export type AgentSession = {
  session_id?: string;
  tool: string;
  model: string;
  premium: boolean;
  premium_requests: number;
  premium_multiplier: number;
  premium_cost_units: number;
  tokens: { input: number; output: number; total: number };
  agent: string;
  turns: number;
  status: "running" | "completed";
  start_date: string;
  end_date: string | null;
  notes?: string;
};

export type StoryStatus =
  | "backlog"
  | "ready-for-dev"
  | "in-progress"
  | "review"
  | "done";

export type StoryWorkflowStepSkill =
  | "bmad-create-story"
  | "bmad-dev-story"
  | "bmad-code-review";

export type EpicWorkflowStepSkill =
  | "bmad-sprint-status"
  | "bmad-sprint-planning"
  | "bmad-retrospective";

export type EpicLifecycleSteps = Record<
  EpicWorkflowStepSkill,
  WorkflowStepState
>;

export type WorkflowStepState =
  | "not-started"
  | "running"
  | "completed"
  | "failed";
export type EpicStatus = "planned" | "backlog" | "in-progress" | "done";

export type RuntimeSession = {
  id: string;
  skill: string;
  model: string;
  storyId: string | null;
  worktreeMode: "git-worktree";
  worktreePath: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  command: string;
  promptPath: string;
  logPath: string;
  exitCode: number | null;
  error: string | null;
  userMessages: Array<{
    id: string;
    text: string;
    sentAt: string;
  }>;
};

export type RuntimeState = {
  status: string;
  startedAt: string;
  updatedAt: string;
  currentStage: string;
  dryRun: boolean;
  execute: boolean;
  nonInteractive: boolean;
  targetStory: { id: string; status: StoryStatus } | null;
  parallelCandidate: { id: string; status: StoryStatus } | null;
  sessions: RuntimeSession[];
  notes: string[];
};

export type AgentRunGroup = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  sessions: RuntimeSession[];
};

export type OverviewResponse = {
  steps: Array<{
    skill: StoryWorkflowStepSkill;
    label: string;
  }>;
  epicSteps: Array<{
    skill: EpicWorkflowStepSkill;
    label: string;
    state: WorkflowStepState;
  }>;
  sprintOverview: {
    totalStories: number;
    storiesByStatus: Record<string, number>;
    stories: Array<{
      id: string;
      status: StoryStatus;
      steps: Record<StoryWorkflowStepSkill, WorkflowStepState>;
    }>;
    epics: Array<{
      id: string;
      number: number;
      status: EpicStatus;
      storyCount: number;
      plannedStoryCount: number;
      storiesToCreate: number;
      byStoryStatus: Record<StoryStatus, number>;
      lifecycleSteps: EpicLifecycleSteps;
    }>;
  };
  runtimeState: RuntimeState | null;
  agentRunner: {
    isRunning: boolean;
    canSendInput: boolean;
    isNonInteractive: boolean;
  };
  externalProcesses: Array<{
    pid: number;
    elapsed: string;
    command: string;
  }>;
  dependencyTree: {
    nodes: Array<{
      id: string;
      label: string;
      status: EpicStatus;
      storyCount: number;
      dependsOn: string[];
    }>;
  };
  epicConsistency: {
    hasMismatch: boolean;
    epicsMarkdownCount: number;
    sprintStatusCount: number;
    warning: string | null;
  };
  storyDependenciesExist: boolean;
  storyDependencies: Record<string, string[]>;
  agentRunHistory: AgentRunGroup[];
  planningArtifactFiles: string[];
  implementationArtifactFiles: string[];
  activeWorkflowSkill: string | null;
  agentSessions: AgentSession[];
};

export type StoryDetailResponse = {
  story: {
    id: string;
    status: StoryStatus;
    markdownPath: string | null;
    markdownContent: string | null;
  };
  steps: Array<{
    skill: StoryWorkflowStepSkill;
    label: string;
    state: WorkflowStepState;
    summary: string;
  }>;
  sessions: RuntimeSession[];
  externalProcesses: Array<{
    pid: number;
    elapsed: string;
    command: string;
  }>;
};

export type EpicDetailResponse = {
  epic: {
    id: string;
    number: number;
    status: EpicStatus;
    plannedStoryCount: number;
    storiesToCreate: number;
  };
  stories: Array<{
    id: string;
    status: StoryStatus;
    steps: Record<StoryWorkflowStepSkill, WorkflowStepState>;
  }>;
  plannedStories: string[];
  storyDependencies: Record<string, string[]>;
};

export type SessionDetailResponse = {
  session: RuntimeSession;
  logContent: string | null;
  promptContent: string | null;
  logExists: boolean;
  promptExists: boolean;
  isRunning: boolean;
  canSendInput: boolean;
};

export type TokenUsage = {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  totalTokens: number;
};

export type AnalyticsSubscription = {
  plan: string;
  seatUsdPerUserPerMonth: number;
  seatPriceSource: string;
};

export type AnalyticsRatesUsd = {
  premiumRequest: number | null;
  inputPer1MTokens: number | null;
  outputPer1MTokens: number | null;
  cachedInputPer1MTokens: number | null;
};

export type AnalyticsEstimatedCostUsd = {
  seatCostPerUserPerMonth: number | null;
  fromPremiumRequests: number | null;
  fromTokens: number | null;
  totalWithKnownRates: number | null;
};

export type AnalyticsCosting = {
  version: number;
  copilotBilling: {
    primaryUnit: string;
    notes: string;
    source: string;
  };
  subscription: AnalyticsSubscription | null;
  totals: {
    premiumRequests: number;
    tokensIn: number;
    tokensOut: number;
    tokensCached: number;
    totalTokens: number;
  };
  ratesUsd: AnalyticsRatesUsd;
  estimatedCostUsd: AnalyticsEstimatedCostUsd;
};

export type SessionAnalytics = {
  sessionId: string;
  storyId: string | null;
  epicId: string | null;
  skill: string;
  model: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  usage: TokenUsage;
};

export type StoryAnalytics = {
  storyId: string;
  epicId: string | null;
  sessionCount: number;
  usage: TokenUsage;
};

export type EpicAnalytics = {
  epicId: string;
  storyCount: number;
  sessionCount: number;
  usage: TokenUsage;
};

export type AnalyticsResponse = {
  sessions: SessionAnalytics[];
  stories: StoryAnalytics[];
  epics: EpicAnalytics[];
  project: TokenUsage;
  costing: AnalyticsCosting;
};
