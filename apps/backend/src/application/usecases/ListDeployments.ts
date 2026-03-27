import { DeploymentRepository, ListDeploymentsFilters, ListDeploymentsPage } from "../../domain/ports/DeploymentRepository.js";
import { getConfig } from "../../infrastructure/config/env.js";

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
  pageInfo: { page: number; pageSize: number; total?: number };
};

export class ListDeployments {
  private readonly repository: DeploymentRepository;

  constructor(repository: DeploymentRepository) {
    this.repository = repository;
  }

  async execute(filters: ListDeploymentsFilters, page: ListDeploymentsPage): Promise<ListDeploymentsResponse> {
    const safePage = page.page > 0 ? page.page : 1;
    const safePageSize = page.pageSize > 0 && page.pageSize <= 100 ? page.pageSize : 10;

    const result = await this.repository.list(
      filters,
      { page: safePage, pageSize: safePageSize },
      { maxScannedItems: getConfig().dashboardDynamoMaxScannedItems }
    );
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
        page: safePage,
        pageSize: safePageSize,
        total: result.total
      }
    };
  }
}
