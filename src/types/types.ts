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

type BuildTimeline = {
    records: {
        id: string;
        parentId: string;
        type: string;
        name: string;
        startTime: string;
        finishTime: string;
        currentState: string;
        result: string;
    }[];
};


export {
    Pipeline,
    PipelinesResponse,
    Project,
    ProjectsResponse,
    BuildTimeline
}