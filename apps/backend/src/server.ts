import dotenv from "dotenv";
import { getConfig } from "./infrastructure/config/env.js";
import { createApp } from "./app.js";

dotenv.config();

const app = createApp();
const config = getConfig();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${config.port}`);
});
