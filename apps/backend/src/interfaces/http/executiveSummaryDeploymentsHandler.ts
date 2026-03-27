import type { Request, Response } from "express";
import { ListEnrichedDeployments } from "../../application/usecases/ListEnrichedDeployments.js";
import { DynamoExecutiveSummaryExecutionsRepository } from "../../infrastructure/dynamodb/DynamoExecutiveSummaryExecutionsRepository.js";
import { DynamoDeploymentMetadataRepository } from "../../infrastructure/dynamodb/DynamoDeploymentMetadataRepository.js";
import { getConfig } from "../../infrastructure/config/env.js";

/** Default range: previous calendar month (UTC), inclusive. */
function defaultPreviousMonthRangeIso(): { from: string; to: string } {
  const now = new Date();
  const firstThisMonthUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0);
  const lastMonthEnd = new Date(firstThisMonthUtc);
  lastMonthEnd.setUTCMilliseconds(-1);
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1, 0, 0, 0, 0));
  return {
    from: lastMonthStart.toISOString(),
    to: lastMonthEnd.toISOString()
  };
}

export async function executiveSummaryDeploymentsHandler(req: Request, res: Response) {
  try {
    let from = typeof req.query.from === "string" ? req.query.from.trim() : "";
    let to = typeof req.query.to === "string" ? req.query.to.trim() : "";
    if (!from || !to) {
      const d = defaultPreviousMonthRangeIso();
      from = d.from;
      to = d.to;
    }

    if (Date.parse(from) > Date.parse(to)) {
      return res.status(400).json({ error: "from must be before or equal to to" });
    }

    const statusQ = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = statusQ === "success" || statusQ === "failure" || statusQ === "unknown" ? statusQ : undefined;

    const projectName = typeof req.query.projectName === "string" ? req.query.projectName : undefined;
    const environment = typeof req.query.environment === "string" ? req.query.environment : undefined;
    const applicationName = typeof req.query.applicationName === "string" ? req.query.applicationName : undefined;
    const job = typeof req.query.job === "string" ? req.query.job : undefined;
    const legacyApplication = typeof req.query.application === "string" ? req.query.application : undefined;
    const jobExact = job?.trim() || legacyApplication?.trim() || undefined;

    const debug = getConfig().logLevel === "debug";

    if (debug) {
      console.debug("[executive_summary:request]", {
        path: "/api/executive-summary/deployments",
        query: { from, to, status, projectName, environment, applicationName, job: jobExact }
      });
    }

    const usecase = new ListEnrichedDeployments(
      new DynamoExecutiveSummaryExecutionsRepository(),
      new DynamoDeploymentMetadataRepository()
    );
    const result = await usecase.execute(
      {
        from,
        to,
        status,
        projectName: projectName?.trim() || undefined,
        environment: environment?.trim() || undefined,
        applicationName: applicationName?.trim() || undefined,
        job: jobExact
      },
      { debug }
    );

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to list enriched deployments" });
  }
}
