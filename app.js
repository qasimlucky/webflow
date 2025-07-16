const createError = require("http-errors");
const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const hpp = require("hpp");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const globalErrorHandler = require("./src/api/v1/middlewares/globalErrorHandler");

if (process.env.NODE_ENV === "PRODUCTION") {
  require("dotenv").config({ path: "./.env.production" });
} else {
  require("dotenv").config();
}

const usersRoutes = require("./src/api/v1/routes/user");
const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(helmet());

if (process.env.NODE_ENV === "DEVELOPMENT") {
  app.use(logger("dev"));
}

app.use(mongoSanitize());
app.use(xssClean());
app.use(hpp());
app.use(cors());
app.use(compression());
app.use(cookieParser());

// Routes
app.use("/api/v1/users", usersRoutes);

// Catch-all route for undefined routes
app.use("*", function (req, res, next) {
  next(createError(404));
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
