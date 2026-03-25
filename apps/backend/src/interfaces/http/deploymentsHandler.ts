import { Request, Response } from "express";
import { ListDeployments } from "../../application/usecases/ListDeployments.js";
import type { DeploymentsSortBy } from "../../domain/ports/DeploymentRepository.js";
import { DynamoDeploymentRepository } from "../../infrastructure/dynamodb/DynamoDeploymentRepository.js";

const ALLOWED_SORT_BY = new Set<DeploymentsSortBy>([
  "executedAt",
  "application",
  "buildNumber",
  "status",
  "executedBy",
  "stage"
]);

function parseSortBy(raw: unknown): DeploymentsSortBy {
  if (typeof raw === "string" && ALLOWED_SORT_BY.has(raw as DeploymentsSortBy)) {
    return raw as DeploymentsSortBy;
  }
  return "executedAt";
}

function parseSortOrder(raw: unknown): "asc" | "desc" {
  if (raw === "asc" || raw === "desc") return raw;
  return "desc";
}

export async function deploymentsHandler(req: Request, res: Response) {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const application = typeof req.query.application === "string" ? req.query.application : undefined;
    const statusQ = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusQ === "success" || statusQ === "failure" || statusQ === "unknown" ? statusQ : undefined;

    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 10);

    const sortBy = parseSortBy(req.query.sortBy);
    const sortOrder = parseSortOrder(req.query.sortOrder);

    const usecase = new ListDeployments(new DynamoDeploymentRepository());
    const result = await usecase.execute(
      { from, to, application, status, sortBy, sortOrder },
      { page: Number.isFinite(page) ? page : 1, pageSize: Number.isFinite(pageSize) ? pageSize : 10 }
    );

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to list deployments" });
  }
}
