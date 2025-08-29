const WebhookDataService = require("../services/webhookData.service");
const catchAsyncHandler = require("../utils/catchAsyncHandler");

class WebhookDataController {
  static getAllWebhookData = catchAsyncHandler(async (req, res) => {
    const result = await WebhookDataService.getAllWebhookData(req.query);
    return res.status(200).json(result);
  });

  static getWebhookDataById = catchAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await WebhookDataService.getWebhookDataById(id);
    return res.status(200).json(result);
  });

  static getWebhookDataByEventType = catchAsyncHandler(async (req, res) => {
    const { eventType } = req.params;
    const result = await WebhookDataService.getWebhookDataByEventType(
      eventType
    );
    return res.status(200).json(result);
  });

  static getWebhookDataByStatus = catchAsyncHandler(async (req, res) => {
    const { status } = req.params;
    const result = await WebhookDataService.getWebhookDataByStatus(status);
    return res.status(200).json(result);
  });

  static getWebhookDataByDateRange = catchAsyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const result = await WebhookDataService.getWebhookDataByDateRange(
      startDate,
      endDate
    );
    return res.status(200).json(result);
  });

  static getWebhookDataWithRelations = catchAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await WebhookDataService.getWebhookDataWithRelations(id);
    return res.status(200).json(result);
  });

  static getAllWebhooksWithRelations = catchAsyncHandler(async (req, res) => {
    const result = await WebhookDataService.getAllWebhooksWithRelations(
      req.query
    );
    return res.status(200).json(result);
  });

  static getWebhooksByEventTypeWithRelations = catchAsyncHandler(
    async (req, res) => {
      const { eventType } = req.params;
      const result =
        await WebhookDataService.getWebhooksByEventTypeWithRelations(eventType);
      return res.status(200).json(result);
    }
  );

  static getWebhookDataByTransactionId = catchAsyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const result = await WebhookDataService.getWebhookDataByTransactionId(
      transactionId
    );
    return res.status(200).json(result);
  });
}

module.exports = WebhookDataController;
