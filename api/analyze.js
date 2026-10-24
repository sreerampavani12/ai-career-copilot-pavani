export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Gemini API key is not configured"
    });
  }

  try {
    const { resume, jobDescription } = req.body || {};

    if (!resume?.trim() || !jobDescription?.trim()) {
      return res.status(400).json({
        error: "Resume and job description are required"
      });
    }

    const prompt = `
ROLE:
You are an expert AI/ML internship recruiter
and resume evaluation specialist.

TASK:
Compare the resume against the job description.

RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

RULES:
- Give an ATS match score from 0 to 100.
- Identify strengths and genuinely missing keywords.
- Give specific, actionable improvements.
- Never invent candidate qualifications.
- Return valid JSON only.

OUTPUT FORMAT:
{
  "ats_score": 0,
  "summary": "Brief candidate summary",
  "strengths": ["strength 1", "strength 2"],
  "missing_keywords": ["keyword 1", "keyword 2"],
"improvements": ["improvement 1", "improvement 2"]}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                ats_score: { type: "INTEGER" },
                summary: { type: "STRING" },
                strengths: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                missing_keywords: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                improvements: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: [
                "ats_score",
                "summary",
                "strengths",
                "missing_keywords",
                "improvements"
              ]
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);
      return res.status(502).json({
        error: "Gemini request failed. Check API configuration."
      });
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("");

    if (!text) {
      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    const result = JSON.parse(text);

    return res.status(200).json(result);

  } catch (error) {
    console.error("Analysis error:", error);
    return res.status(500).json({
      error: "Unable to analyze this resume"
    });
  }
}
