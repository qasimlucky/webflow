const WebhookData = require("../model/WebhookData");
const ProcessMetadata = require("../model/ProcessMetadata");
const EspBuchung = require("../model/EspBuchung");
const AppError = require("../utils/AppError");
const HttpStatusCodes = require("../enums/httpStatusCode");

class WebhookDataService {
  static async getAllWebhookData(query = {}) {
    try {
      const webhooks = await WebhookData.find(query)
        .sort({ received_at: -1 })
        .limit(100); // Limit to prevent overwhelming responses

      return {
        success: true,
        message: "Webhook data retrieved successfully",
        data: webhooks,
        count: webhooks.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve webhook data",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async getWebhookDataById(id) {
    try {
      const webhook = await WebhookData.findById(id);

      if (!webhook) {
        throw new AppError("Webhook data not found", HttpStatusCodes.NOT_FOUND);
      }

      return {
        success: true,
        message: "Webhook data retrieved successfully",
        data: webhook,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        "Failed to retrieve webhook data",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async getWebhookDataByEventType(eventType) {
    try {
      const webhooks = await WebhookData.find({
        event_type: { $regex: eventType, $options: "i" },
      }).sort({ received_at: -1 });

      return {
        success: true,
        message: "Webhook data retrieved successfully",
        data: webhooks,
        count: webhooks.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve webhook data by event type",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async getWebhookDataByStatus(status) {
    try {
      const webhooks = await WebhookData.find({ status }).sort({
        received_at: -1,
      });

      return {
        success: true,
        message: "Webhook data retrieved successfully",
        data: webhooks,
        count: webhooks.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve webhook data by status",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async getWebhookDataByDateRange(startDate, endDate) {
    try {
      const query = {};

      if (startDate && endDate) {
        query.received_at = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const webhooks = await WebhookData.find(query).sort({ received_at: -1 });

      return {
        success: true,
        message: "Webhook data retrieved successfully",
        data: webhooks,
        count: webhooks.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve webhook data by date range",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Get webhook data with complete relationship chain: WebhookData → ProcessMetadata → EspBuchung
  static async getWebhookDataWithRelations(webhookId) {
    try {
      const webhook = await WebhookData.findById(webhookId);

      if (!webhook) {
        throw new AppError("Webhook data not found", HttpStatusCodes.NOT_FOUND);
      }

      // Extract transaction_id from payload
      const transactionId =
        webhook.payload?.transaction_id ||
        webhook.payload?.transaction_data?.id;

      if (!transactionId) {
        return {
          success: true,
          message: "Webhook data retrieved (no transaction relationship found)",
          data: {
            webhook,
            processMetadata: null,
            espBuchung: null,
            relationshipChain: {
              hasTransactionId: false,
              hasProcessMetadata: false,
              hasEspBuchung: false,
            },
          },
        };
      }

      // Use MongoDB aggregation to fetch related data efficiently
      const result = await WebhookData.aggregate([
        { $match: { _id: webhook._id } },
        {
          $addFields: {
            transactionId: {
              $cond: {
                if: { $ne: ["$payload.transaction_id", null] },
                then: "$payload.transaction_id",
                else: "$payload.transaction_data.id",
              },
            },
          },
        },
        {
          $lookup: {
            from: "processmetadatas", // MongoDB collection name (lowercase + plural)
            let: { transactionId: "$transactionId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$transactionCode", "$$transactionId"] },
                },
              },
            ],
            as: "processMetadata",
          },
        },
        {
          $lookup: {
            from: "espbuchungs", // MongoDB collection name (lowercase + plural)
            let: {
              espBuchungId: {
                $arrayElemAt: ["$processMetadata.espBuchungId", 0],
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$espBuchungId"] },
                },
              },
            ],
            as: "espBuchung",
          },
        },
        {
          $addFields: {
            processMetadata: { $arrayElemAt: ["$processMetadata", 0] },
            espBuchung: { $arrayElemAt: ["$espBuchung", 0] },
            relationshipChain: {
              hasTransactionId: { $ne: ["$transactionId", null] },
              hasProcessMetadata: { $gt: [{ $size: "$processMetadata" }, 0] },
              hasEspBuchung: { $gt: [{ $size: "$espBuchung" }, 0] },
            },
          },
        },
      ]);

      if (result.length === 0) {
        throw new AppError("Webhook data not found", HttpStatusCodes.NOT_FOUND);
      }

      const webhookWithRelations = result[0];

      return {
        success: true,
        message: "Webhook data with relationships retrieved successfully",
        data: webhookWithRelations,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        "Failed to retrieve webhook data with relationships",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Get all webhooks with their complete relationship chains
  static async getAllWebhooksWithRelations(query = {}) {
    try {
      // Use MongoDB aggregation to fetch all webhooks with relationships efficiently
      const aggregationPipeline = [
        // Apply the base query
        ...(Object.keys(query).length > 0 ? [{ $match: query }] : []),

        // Sort by received_at descending
        { $sort: { received_at: -1 } },

        // Limit results for performance
        { $limit: 50 },

        // Add transaction ID field
        {
          $addFields: {
            transactionId: {
              $cond: {
                if: { $ne: ["$payload.transaction_id", null] },
                then: "$payload.transaction_id",
                else: "$payload.transaction_data.id",
              },
            },
          },
        },

        // Lookup ProcessMetadata using transactionCode
        {
          $lookup: {
            from: "processmetadatas", // MongoDB collection name (lowercase + plural)
            let: { transactionId: "$transactionId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$transactionCode", "$$transactionId"] },
                },
              },
            ],
            as: "processMetadata",
          },
        },

        // Lookup EspBuchung using espBuchungId from ProcessMetadata
        {
          $lookup: {
            from: "espbuchungs", // MongoDB collection name (lowercase + plural)
            let: {
              espBuchungId: {
                $arrayElemAt: ["$processMetadata.espBuchungId", 0],
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$espBuchungId"] },
                },
              },
            ],
            as: "espBuchung",
          },
        },

        // Transform arrays to single objects and add relationship status
        {
          $addFields: {
            processMetadata: { $arrayElemAt: ["$processMetadata", 0] },
            espBuchung: { $arrayElemAt: ["$espBuchung", 0] },
            hasCompleteChain: {
              $and: [
                { $ne: ["$transactionId", null] },
                { $gt: [{ $size: "$processMetadata" }, 0] },
                { $gt: [{ $size: "$espBuchung" }, 0] },
              ],
            },
          },
        },
      ];

      const webhooksWithRelations = await WebhookData.aggregate(
        aggregationPipeline
      );

      return {
        success: true,
        message: "Webhooks with relationships retrieved successfully",
        data: webhooksWithRelations,
        count: webhooksWithRelations.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve webhooks with relationships",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Get webhooks by specific event type with relationships
  static async getWebhooksByEventTypeWithRelations(eventType) {
    try {
      // Use MongoDB aggregation to fetch webhooks by event type with relationships efficiently
      const aggregationPipeline = [
        // Match by event type
        {
          $match: {
            event_type: { $regex: eventType, $options: "i" },
          },
        },

        // Sort by received_at descending
        { $sort: { received_at: -1 } },

        // Add transaction ID field
        {
          $addFields: {
            transactionId: {
              $cond: {
                if: { $ne: ["$payload.transaction_id", null] },
                then: "$payload.transaction_id",
                else: "$payload.transaction_data.id",
              },
            },
          },
        },

        // Lookup ProcessMetadata using transactionCode
        {
          $lookup: {
            from: "processmetadatas", // MongoDB collection name (lowercase + plural)
            let: { transactionId: "$transactionId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$transactionCode", "$$transactionId"] },
                },
              },
            ],
            as: "processMetadata",
          },
        },

        // Lookup EspBuchung using espBuchungId from ProcessMetadata
        {
          $lookup: {
            from: "espbuchungs", // MongoDB collection name (lowercase + plural)
            let: {
              espBuchungId: {
                $arrayElemAt: ["$processMetadata.espBuchungId", 0],
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$espBuchungId"] },
                },
              },
            ],
            as: "espBuchung",
          },
        },

        // Transform arrays to single objects and add relationship status
        {
          $addFields: {
            processMetadata: { $arrayElemAt: ["$processMetadata", 0] },
            espBuchung: { $arrayElemAt: ["$espBuchung", 0] },
            hasCompleteChain: {
              $and: [
                { $ne: ["$transactionId", null] },
                { $gt: [{ $size: "$processMetadata" }, 0] },
                { $gt: [{ $size: "$espBuchung" }, 0] },
              ],
            },
          },
        },
      ];

      const webhooksWithRelations = await WebhookData.aggregate(
        aggregationPipeline
      );

      return {
        success: true,
        message: `Webhooks with event type '${eventType}' and relationships retrieved successfully`,
        data: webhooksWithRelations,
        count: webhooksWithRelations.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve webhooks by event type with relationships",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Get webhook data by transaction ID using aggregation
  static async getWebhookDataByTransactionId(transactionId) {
    try {
      const aggregationPipeline = [
        // Match webhooks that contain this transaction ID in payload
        {
          $match: {
            $or: [
              { "payload.transaction_id": transactionId },
              { "payload.transaction_data.id": transactionId },
            ],
          },
        },

        // Sort by received_at descending
        { $sort: { received_at: -1 } },

        // Add transaction ID field
        {
          $addFields: {
            extractedTransactionId: {
              $cond: {
                if: { $ne: ["$payload.transaction_id", null] },
                then: "$payload.transaction_id",
                else: "$payload.transaction_data.id",
              },
            },
          },
        },

        // Lookup ProcessMetadata using transactionCode
        {
          $lookup: {
            from: "processmetadatas",
            let: { transactionId: "$extractedTransactionId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$transactionCode", "$$transactionId"] },
                },
              },
            ],
            as: "processMetadata",
          },
        },

        // Lookup EspBuchung using espBuchungId from ProcessMetadata
        {
          $lookup: {
            from: "espbuchungs",
            let: {
              espBuchungId: {
                $arrayElemAt: ["$processMetadata.espBuchungId", 0],
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$espBuchungId"] },
                },
              },
            ],
            as: "espBuchung",
          },
        },

        // Transform arrays to single objects and add relationship status
        {
          $addFields: {
            processMetadata: { $arrayElemAt: ["$processMetadata", 0] },
            espBuchung: { $arrayElemAt: ["$espBuchung", 0] },
            hasCompleteChain: {
              $and: [
                { $ne: ["$extractedTransactionId", null] },
                { $gt: [{ $size: "$processMetadata" }, 0] },
                { $gt: [{ $size: "$espBuchung" }, 0] },
              ],
            },
          },
        },
      ];

      const webhooksWithRelations = await WebhookData.aggregate(
        aggregationPipeline
      );

      return {
        success: true,
        message: "Webhook data by transaction ID retrieved successfully",
        data: webhooksWithRelations,
        count: webhooksWithRelations.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve webhook data by transaction ID",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
}

module.exports = WebhookDataService;
