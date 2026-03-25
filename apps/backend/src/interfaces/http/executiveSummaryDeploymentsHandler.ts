import type { Request, Response } from "express";
import { ListEnrichedDeployments } from "../../application/usecases/ListEnrichedDeployments.js";
import { DynamoDeploymentRepository } from "../../infrastructure/dynamodb/DynamoDeploymentRepository.js";
import { DynamoDeploymentMetadataRepository } from "../../infrastructure/dynamodb/DynamoDeploymentMetadataRepository.js";
import { getConfig } from "../../infrastructure/config/env.js";

export async function executiveSummaryDeploymentsHandler(req: Request, res: Response) {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const application = typeof req.query.application === "string" ? req.query.application : undefined;
    const statusQ = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusQ === "success" || statusQ === "failure" || statusQ === "unknown" ? statusQ : undefined;

    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 10);

    const safePageNum = Number.isFinite(page) ? page : 1;
    const safePageSizeNum = Number.isFinite(pageSize) ? pageSize : 10;
    const debug = getConfig().logLevel === "debug";

    if (debug) {
      console.debug("[executive_summary:request]", {
        path: "/api/executive-summary/deployments",
        query: { from, to, application, status, page: safePageNum, pageSize: safePageSizeNum }
      });
    }

    const usecase = new ListEnrichedDeployments(new DynamoDeploymentRepository(), new DynamoDeploymentMetadataRepository());
    const result = await usecase.execute(
      { from, to, application, status },
      { page: safePageNum, pageSize: safePageSizeNum },
      { debug }
    );

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to list enriched deployments" });
  }
}
