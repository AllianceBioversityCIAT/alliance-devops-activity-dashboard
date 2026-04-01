import { Router } from "express";
import { healthHandler } from "./healthHandler.js";
import { deploymentsHandler } from "./deploymentsHandler.js";
import { executiveSummaryDeploymentsHandler } from "./executiveSummaryDeploymentsHandler.js";
import { executiveAvailabilityHandler } from "./executiveAvailabilityHandler.js";
import { authMiddleware } from "./authMiddleware.js";
import { loginHandler } from "./authHandler.js";
import { authorizeHandler, exchangeHandler } from "./oauthHandlers.js";

export function createRouter(): Router {
  const router = Router();

  // Public
  router.get("/health", healthHandler);
  router.post("/auth/login", loginHandler);
  router.get("/auth/authorize", authorizeHandler);
  router.post("/auth/exchange", exchangeHandler);

  // Mock protected endpoints (auth to be enforced in Phase 2)
  router.get("/deployments", authMiddleware, deploymentsHandler);
  router.get("/api/deployments", authMiddleware, deploymentsHandler);
  router.get("/api/executive-summary/deployments", authMiddleware, executiveSummaryDeploymentsHandler);
  router.get("/api/executive-availability/incidents", authMiddleware, executiveAvailabilityHandler);

  return router;
}
