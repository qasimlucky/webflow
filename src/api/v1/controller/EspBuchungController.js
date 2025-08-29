const EspBuchungService = require("../services/espBuchung.service");
const catchAsyncHandler = require("../utils/catchAsyncHandler");

class EspBuchungController {
  static getAllEspBuchungen = catchAsyncHandler(async (req, res) => {
    const result = await EspBuchungService.getAllEspBuchungen(req.query);
    return res.status(200).json(result);
  });

  static getEspBuchungById = catchAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await EspBuchungService.getEspBuchungById(id);
    return res.status(200).json(result);
  });

  static getEspBuchungenByEmail = catchAsyncHandler(async (req, res) => {
    const { email } = req.params;
    const result = await EspBuchungService.getEspBuchungenByEmail(email);
    return res.status(200).json(result);
  });

  static getEspBuchungenByDateRange = catchAsyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const result = await EspBuchungService.getEspBuchungenByDateRange(
      startDate,
      endDate
    );
    return res.status(200).json(result);
  });
}

module.exports = EspBuchungController;
