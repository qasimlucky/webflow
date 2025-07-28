const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { Buffer } = require("buffer");

const resumeStyles = [
  "focus on leadership and teamwork",
  "highlight technical expertise and project impact",
  "emphasize problem-solving and creativity",
  "showcase continuous learning and adaptability",
  "prioritize communication and collaboration",
];

function detectFileType(base64) {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.slice(0, 4).toString() === "%PDF") return "pdf";
  if (buffer.slice(0, 2).toString() === "PK") return "docx";
  return "txt";
}

async function extractTextFromBase64(base64) {
  const fileType = detectFileType(base64);
  const buffer = Buffer.from(base64, "base64");
  if (fileType === "pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (fileType === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  } else {
    return buffer.toString("utf-8");
  }
}

async function generateResumes({ baseResumeText = "", isBase64 = false }) {
  let extractedResumeText = baseResumeText;
  if (isBase64 && baseResumeText) {
    extractedResumeText = await extractTextFromBase64(baseResumeText);
  }
  return [{ extractedText: extractedResumeText }];
}

module.exports = { generateResumes }; 