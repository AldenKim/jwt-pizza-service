const { DB } = require("./database/database.js");
const createService = require("./service.js");
const logger = require("./logger.js");

const port = process.argv[2] || 3000;

process.on("uncaughtException", (err) => {
  logger.log("error", "unhandled_exception", {
    message: err.message,
    stack: err.stack,
    errorStatusCode: err.statusCode ?? 500,
  });

  console.error("Uncaught Exception! Logging and exiting...");
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason) => {
  logger.log("error", "unhandled_exception", {
    subtype: "unhandledRejection",
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : null,
  });
  console.error("Unhandled Rejection detected. Logging to Grafana...");
});

const app = createService(DB);

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
