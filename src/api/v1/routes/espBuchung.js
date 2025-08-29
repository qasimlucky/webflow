const express = require("express");
const EspBuchungController = require("../controller/EspBuchungController");

const router = express.Router();

// Public routes (if any)
router.get("/", EspBuchungController.getAllEspBuchungen);
router.get("/email/:email", EspBuchungController.getEspBuchungenByEmail);
router.get("/date-range", EspBuchungController.getEspBuchungenByDateRange);

// Protected routes
router.get("/:id", EspBuchungController.getEspBuchungById);

module.exports = router;
