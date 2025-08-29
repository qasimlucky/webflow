const express = require("express");
const WebhookDataController = require("../controller/WebhookDataController");

const router = express.Router();

// Public routes (if any)
router.get("/", WebhookDataController.getAllWebhookData);
router.get(
  "/event-type/:eventType",
  WebhookDataController.getWebhookDataByEventType
);
router.get("/status/:status", WebhookDataController.getWebhookDataByStatus);
router.get("/date-range", WebhookDataController.getWebhookDataByDateRange);
router.get(
  "/transaction/:transactionId",
  WebhookDataController.getWebhookDataByTransactionId
);

// Protected routes
router.get("/:id", WebhookDataController.getWebhookDataById);
router.get(
  "/:id/with-relations",

  WebhookDataController.getWebhookDataWithRelations
);
router.get(
  "/with-relations",

  WebhookDataController.getAllWebhooksWithRelations
);
router.get(
  "/event-type/:eventType/with-relations",

  WebhookDataController.getWebhooksByEventTypeWithRelations
);

module.exports = router;
