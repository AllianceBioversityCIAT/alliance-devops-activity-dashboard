import {
  DeploymentRepository,
  DeploymentsSortBy,
  ListDeploymentsFilters,
  ListDeploymentsQueryPage
} from "../../domain/ports/DeploymentRepository.js";

export type ListDeploymentsResponse = {
  items: Array<{
    id: string;
    application: string;
    executedAt: string;
    buildNumber?: number;
    status: "success" | "failure" | "unknown";
    executedBy?: string;
    stage?: string;
    pipelineUrl?: string;
    errorMessage?: string;
  }>;
  pageInfo: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
    effectiveSortBy: DeploymentsSortBy;
    sortWarning?: string;
  };
};

export class ListDeployments {
  private readonly repository: DeploymentRepository;

  constructor(repository: DeploymentRepository) {
    this.repository = repository;
  }

  async execute(filters: ListDeploymentsFilters, page: ListDeploymentsQueryPage): Promise<ListDeploymentsResponse> {
    const safeLimit = page.limit > 0 && page.limit <= 100 ? page.limit : 10;
    const result = await this.repository.list(filters, { limit: safeLimit, cursor: page.cursor });

    const sortWarning =
      filters.sortBy != null && filters.sortBy !== "executedAt"
        ? "Server pagination orders by execution time (DynamoDB sort key). Choosing another column sorts only the current page in the browser."
        : result.sortWarning;

    return {
      items: result.items.map((d) => ({
        id: d.id,
        application: d.application,
        executedAt: d.executedAt,
        buildNumber: d.buildNumber,
        status: d.status,
        executedBy: d.executedBy,
        stage: d.stage,
        pipelineUrl: d.pipelineUrl,
        errorMessage: d.errorMessage
      })),
      pageInfo: {
        limit: safeLimit,
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
        effectiveSortBy: result.effectiveSortBy,
        ...(sortWarning ? { sortWarning } : {})
      }
    };
  }
}
