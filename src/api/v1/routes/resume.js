const express = require("express");
const ResumeController = require("../controller/ResumeController");
const router = express.Router();

router.post("/generate", ResumeController.generate);

module.exports = router; 