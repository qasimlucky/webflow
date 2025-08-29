const EspBuchung = require("../model/EspBuchung");
const AppError = require("../utils/AppError");
const HttpStatusCodes = require("../enums/httpStatusCode");

class EspBuchungService {
  static async getAllEspBuchungen(query = {}) {
    try {
      const espBuchungen = await EspBuchung.find(query).sort({ createdAt: -1 });

      return {
        success: true,
        message: "EspBuchungen retrieved successfully",
        data: espBuchungen,
        count: espBuchungen.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve EspBuchungen",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async getEspBuchungById(id) {
    try {
      const espBuchung = await EspBuchung.findById(id);

      if (!espBuchung) {
        throw new AppError("EspBuchung not found", HttpStatusCodes.NOT_FOUND);
      }

      return {
        success: true,
        message: "EspBuchung retrieved successfully",
        data: espBuchung,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        "Failed to retrieve EspBuchung",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async getEspBuchungenByEmail(email) {
    try {
      const espBuchungen = await EspBuchung.find({
        ESP_Kontakt_EMailAdresse: { $regex: email, $options: "i" },
      }).sort({ createdAt: -1 });

      return {
        success: true,
        message: "EspBuchungen retrieved successfully",
        data: espBuchungen,
        count: espBuchungen.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve EspBuchungen by email",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async getEspBuchungenByDateRange(startDate, endDate) {
    try {
      const query = {};

      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const espBuchungen = await EspBuchung.find(query).sort({ createdAt: -1 });

      return {
        success: true,
        message: "EspBuchungen retrieved successfully",
        data: espBuchungen,
        count: espBuchungen.length,
      };
    } catch (error) {
      throw new AppError(
        "Failed to retrieve EspBuchungen by date range",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
}

module.exports = EspBuchungService;
