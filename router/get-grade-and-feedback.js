const express = require("express");
const {
  getGeminiChatCompletion,
} = require("../api/general/get-chat-completion.js");

const {
  GradeAndFeedbackSchema,
  cleanGradeAndFeedback,
} = require("../api/models/GradeAndFeedback.js");

const getGradeCriteriaText = require("../utils/getGradeCriteriaText.js");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { text, exam } = req.body || {};

    if (!text) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: text" });
    }

    const systemPrompt =
`Act like a professional exam grader. Your job is to generate a grade and feedback for a student. You will be given a transcript and from that evaluate the performance of the student and give the student a grade and feedback.

Rules for grade:
- Include only if an explicit grade is stated (e.g., "grade: 4", "I'd give you a 10"). Must be a number.
- If multiple grades appear, use the last one.
- If no explicit grade exists, return null.

Rules for feedback:
- Include only explicit performance comments or actionable advice directed at the student.
- Include: specific praise/critique tied to skills, actionable advice, labeled feedback sections.
- Exclude: acknowledgements ("That looks good/correct"), procedural/time messages ("Share your screen", "You still have time"), questions/instructions ("Can you...?"), system/meta messages.
- When present, format as a concise bullet list (each line starting with "- ") with concrete, actionable points.
- If no explicit feedback exists, return null.

Never output empty strings -- use null instead.

Always output in danish`;

    // Optional exam meta
    const title = exam?.title;
    const description = exam?.description;
    const learning_goals = exam?.learning_goals;
    const rawGradeCriteria = exam?.grade_criteria;
    const grade_criteria =
      typeof rawGradeCriteria === "string" && rawGradeCriteria.trim()
        ? getGradeCriteriaText(rawGradeCriteria.trim()) || rawGradeCriteria
        : undefined;

    const examMetaSection = [
      title
        ? `Exam title:\n<title>\n${title}\n</title>`
        : "",
      description
        ? `Exam description:\n<description>\n${description}\n</description>`
        : "",
      learning_goals
        ? `Learning goals being examined:\n<learning_goals>\n${learning_goals}\n</learning_goals>`
        : "",
      grade_criteria
        ? `Grade criteria:\n<grade_criteria>\n${grade_criteria}\n</grade_criteria>`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const prompt = `Generate a grade and feedback for a student with this examiner transcript.

Example 1 (has feedback + grade):
Input: "...good understanding of HTML structure...pay closer attention to syntax...I would give you a grade of 4."
Output: {"result":{"feedback":"- Good understanding of HTML structure\n- Pay closer attention to syntax","grade":"4"}}

Example 2 (no feedback, no grade):
Input: "That looks good. Correct. You still have time to finish the task."
Output: {"result":{"feedback":null,"grade":null}}

${examMetaSection ? `${examMetaSection}\n` : ""}
Transcript:
"""
${text}
"""

Always output in danish`;

/* console.log(systemPrompt);
console.log(prompt); */

    const parsed = await getGeminiChatCompletion(
      systemPrompt,
      prompt,
      GradeAndFeedbackSchema,
      "gemini-2.5-flash-lite"
    );

    res.json(cleanGradeAndFeedback(parsed));
  } catch (error) {
    console.error("Error getting grade and feedback:", error);
    res.status(500).json({
      error: "Failed to generate grade and feedback",
    });
  }
});

module.exports = router;
