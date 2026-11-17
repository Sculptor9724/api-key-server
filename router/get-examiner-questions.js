const express = require("express");
const {
  getGeminiChatCompletion,
} = require("../api/general/get-chat-completion.js");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      learning_goals,
      description,
      title,
      duration,
      typical_questions,
      examples,
      task_generation_instructions,
    } = req.body;

    console.log(learning_goals);
    

    

    if (!learning_goals) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: learning_goals" });
    }
    if (!title) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: title" });
    }
    if (!duration) {
      return res
        .status(400)
        .json({ error: "Missing required parameter: duration" });
    }

    const time_for_feedback = 1;
    const activeExaminationMin = duration - time_for_feedback;

    const titleSection = title
      ? `
Exam title:
"""
${title}
"""
`
      : "";

    const descriptionSection = description
      ? `
Here is the description for the exam:
"""
${description}
"""
`
      : "";

    const learningGoalsSection = learning_goals
      ? `
Learning goals being examined:
"""
${learning_goals}
"""
`
      : "";

    const typicalQuestionsSection = typical_questions
      ? `
Typical Questions:
"""
${typical_questions}
"""
`
      : "";

    const examplesSection = examples
      ? `
Be inspired by the following examples :
"""
${examples}
"""
`
      : "";

    const taskGenerationInstructionsSection = task_generation_instructions
      ? `
Additional Instructions for Task Generation:
"""
${task_generation_instructions}
"""
`
      : "";

    const prompt =
      `Create a new task for an exam for an exam with the following details:

${titleSection}
${descriptionSection}
${learningGoalsSection}

Exam duration in minutes:
"""
${duration - 1}
"""
${typicalQuestionsSection}
${examplesSection}
${taskGenerationInstructionsSection}

Output of the task:
Output the task in Markdown format. Simply write the task and get straight to the point. Also dont include the title of the exam. Dont start with three backticks!


  `.trim();
//console.log(examples);
console.log(prompt);

    const taskStudent = await getGeminiChatCompletion(
      "You are an expert lecturer creating tasks for an exam. Please focus on creating tasks that are engaging, well structured and understandable",
      prompt,
      undefined,
      undefined,
      1.2,
    );

    res.json(taskStudent);
  } catch (error) {
    console.error("Error fetching exam content:", error);
    res.status(500).json({
      "task-student": "Error: Failed to connect to AI service.",
    });
  }
});

module.exports = router;
