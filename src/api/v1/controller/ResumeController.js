const { generateResumes } = require("../services/resume.service");

class ResumeController {
  static generate = async (req, res) => {
    try {
      let { rows, settings, baseResumeText = "", isBase64 = false } = req.body;
      // if (!rows || !Array.isArray(rows) || rows.length === 0) {
      //   return res.status(400).json({ error: "Rows are required." });
      // }
      const resumes = await generateResumes({ rows, settings, baseResumeText, isBase64 });
      return res.status(200).json({ resumes });
    } catch (err) {
      console.error("Resume generation error:", err);
      return res.status(500).json({ error: "Internal server error." });
    }
  };
}

module.exports = ResumeController; 