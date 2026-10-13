// Starts the API process. Run separately from src/jobs/worker.js — this
// process only handles HTTP requests, the worker process handles queued
// notification jobs. In dev you'll run both (`npm run dev` + `npm run worker`).
require("node:dns").setDefaultResultOrder("ipv4first");
const buildApp = require("./app");

const PORT = process.env.PORT || 3000;

buildApp()
  .then((app) => {
    app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
      console.log(`Admin backoffice UI at /backoffice`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
