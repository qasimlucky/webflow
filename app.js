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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log incoming request
  console.log(`\n🚀 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
  console.log(`🔍 Query:`, JSON.stringify(req.query, null, 2));
  console.log(`👤 User Agent:`, req.headers['user-agent'] || 'Unknown');
  console.log(`🌐 Origin:`, req.headers['origin'] || 'No Origin');
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`✅ [${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    console.log(`📤 Response:`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    console.log(`📊 Response Headers:`, JSON.stringify(res.getHeaders(), null, 2));
    console.log('─'.repeat(80));
    
    originalSend.call(this, data);
  };
  
  next();
});

// Super simple CORS - allow everything
app.use(cors({
  origin: '*',
  credentials: false,
  methods: '*',
  allowedHeaders: '*',
  exposedHeaders: '*'
}));

// Simple fallback for any CORS issues
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

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
