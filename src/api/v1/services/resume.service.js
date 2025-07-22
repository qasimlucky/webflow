const OpenAI = require("openai");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { Buffer } = require("buffer");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

function extractNameFromText(text) {
  // Simple heuristic: first non-empty line
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Optionally, add more sophisticated name detection here
  return lines.length > 0 ? lines[0] : "";
}

function buildPrompt(row, settings, style, baseResumeText, isBase64, extractedName) {
  return `
You are an expert resume writer. Your task is to create a compelling, professional, and ready-to-submit resume tailored to the job below.

${extractedName ? `The candidate's name is: ${extractedName}. Use this name in the resume.` : ""}

If a base resume is provided, use it as a reference. Improve its structure, highlight relevant experience and skills that align with the job, and rewrite sections as necessary to make the candidate a strong fit. Preserve any realistic information, tone, or accomplishments that help the candidate stand out.

---

### 🧾 Job Details:
- *Company URL:* ${row?.url || "N/A"}
- *Job Title:* ${row?.title || "N/A"}
- *Job Description:* ${row?.description || "N/A"}
- *Required Skills:* ${row?.skills || "N/A"}

---

### 👤 Candidate Settings:
- *Language:* ${settings?.language || "English"}
- *Years of Experience:* ${settings?.years || "5+"}

---
${
  baseResumeText
    ? isBase64
      ? `### 📄 Base Resume (base64-encoded):

${baseResumeText}

The above is a base64-encoded file (PDF, DOCX, or TXT). Extract the text from it and use it as a base resume.
- Reuse any real personal information found in the file, such as name, address, phone, email, LinkedIn, and other links.
- Only generate fictional details if any of these are missing.
- Improve and rewrite the resume where necessary to align with the job.`
      : `### 📄 Base Resume (Plain Text):

${baseResumeText}

Extract and reuse any real personal information found in the file, such as name, address, phone, email, LinkedIn, and other links.
Only generate fictional details if any of these are missing.
Improve and rewrite the resume where necessary to align with the job.`
    : `### ❗ No Base Resume Provided:

Generate a complete and realistic fictional resume from scratch based on the job description and candidate settings.`
}

---

### 📌 Resume Requirements:
- A realistic candidate name
- Complete contact info (address, phone, email, LinkedIn)
- A tailored and engaging professional summary
- Work experience (${settings?.years || "N/A"} years) with:
  - Realistic job titles, companies, and dates
  - Responsibilities and measurable achievements
- Education background
- Technical and soft skills relevant to the role
- Certifications, notable projects, or any other relevant sections

---

### 🎯 Style Guidance:
Please ${
    style ||
    "follow a modern, ATS-friendly, professional style appropriate for the industry"
  }.

---

🚫 *Important:* Do NOT use placeholders like [Your Name], [Company Name], or [Phone Number]. All information must appear realistic and ready for use.
  `.trim();
}

async function generateResumes({ rows, settings, baseResumeText = "", isBase64 = false }) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new Error("Rows are required.");
  }
  const numResumes = Math.max(1, Math.min(Number(settings.numResumes) || 5, 50));
  const resumes = [];

  let extractedResumeText = baseResumeText;
  let extractedName = "";
  if (isBase64 && baseResumeText) {
    extractedResumeText = await extractTextFromBase64(baseResumeText);
    extractedName = extractNameFromText(extractedResumeText);
    isBase64 = false; // Now it's plain text
  }

  for (let i = 0; i < numResumes; i++) {
    const row = rows[i % rows.length];
    const style = resumeStyles[Math.floor(Math.random() * resumeStyles.length)];
    const prompt = buildPrompt(row, settings, style, extractedResumeText, isBase64, extractedName);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert resume writer." },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
    });

    resumes.push({
      filename: `resume_${i + 1}.txt`,
      content: completion.choices[0].message.content,
    });
  }
  return resumes;
}

module.exports = { generateResumes }; 