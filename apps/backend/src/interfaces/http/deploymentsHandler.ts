import { Request, Response } from "express";
import { ListDeployments } from "../../application/usecases/ListDeployments.js";
import type { DeploymentsSortBy } from "../../domain/ports/DeploymentRepository.js";
import { DynamoDeploymentRepository } from "../../infrastructure/dynamodb/DynamoDeploymentRepository.js";
import { DynamoDeploymentMetadataRepository } from "../../infrastructure/dynamodb/DynamoDeploymentMetadataRepository.js";

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

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(100, Math.floor(n));
}

export async function deploymentsHandler(req: Request, res: Response) {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const application = typeof req.query.application === "string" ? req.query.application : undefined;
    const statusQ = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusQ === "success" || statusQ === "failure" || statusQ === "unknown" ? statusQ : undefined;

    const cursor = typeof req.query.cursor === "string" && req.query.cursor.length > 0 ? req.query.cursor : undefined;
    const limit = parseLimit(req.query.pageSize ?? req.query.limit);

    const sortBy = parseSortBy(req.query.sortBy);
    const sortOrder = parseSortOrder(req.query.sortOrder);

    const usecase = new ListDeployments(
      new DynamoDeploymentRepository(new DynamoDeploymentMetadataRepository())
    );
    const result = await usecase.execute(
      { from, to, application, status, sortBy, sortOrder },
      { limit, cursor }
    );

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to list deployments" });
  }
}
