import { Request, Response } from "express";
import { loginWithCognito } from "../../infrastructure/auth/cognito.js";

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  try {
    const tokens = await loginWithCognito(email, password);
    if (!tokens.idToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.json(tokens);
  } catch (err) {
    // Provide a clearer but safe error for debugging
    return res.status(401).json({ error: "Authentication failed. Verify credentials and client settings." });
  }
}
