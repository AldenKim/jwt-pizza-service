const express = require("express");
const createAuthRouter = require("./routes/authRouter.js");
const createOrderRouter = require("./routes/orderRouter.js");
const createFranchiseRouter = require("./routes/franchiseRouter.js");
const createUserRouter = require("./routes/userRouter.js");
const version = require("./version.json");
const config = require("./config.js");

module.exports = (DB) => {
  const authBundle = createAuthRouter(DB);
  const franchiseRouter = createFranchiseRouter(authBundle.router, DB);
  const orderRouter = createOrderRouter(authBundle.router, DB);
  const userRouter = createUserRouter(
    authBundle.router,
    authBundle.setAuth,
    DB,
  );

  const app = express();
  app.use(express.json());
  app.use(authBundle.setAuthUser);
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    next();
  });

  const apiRouter = express.Router();
  app.use("/api", apiRouter);
  apiRouter.use("/auth", authBundle.router);
  apiRouter.use("/user", userRouter);
  apiRouter.use("/order", orderRouter);
  apiRouter.use("/franchise", franchiseRouter);

  apiRouter.use("/docs", (req, res) => {
    res.json({
      version: version.version,
      endpoints: [
        ...authBundle.router.docs,
        ...userRouter.docs,
        ...orderRouter.docs,
        ...franchiseRouter.docs,
      ],
      config: { factory: config.factory.url, db: config.db.connection.host },
    });
  });

  app.get("/", (req, res) => {
    res.json({
      message: "welcome to JWT Pizza",
      version: version.version,
    });
  });

  app.use("*", (req, res) => {
    res.status(404).json({
      message: "unknown endpoint",
    });
  });

  // Default error handler for all exceptions and errors.
  app.use((err, req, res, next) => {
    res
      .status(err.statusCode ?? 500)
      .json({ message: err.message, stack: err.stack });
    next();
  });

  return app;
};
