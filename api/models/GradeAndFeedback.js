const { Type } = require("@google/genai");

const GradeAndFeedbackSchema = {
  type: Type.OBJECT,
  properties: {
    result: {
      type: Type.OBJECT,
      properties: {
        feedback: {
          type: Type.STRING,
          nullable: true,
          description: "Concise bullet-list feedback or null if no feedback is given",
        },
        grade: {
          type: Type.STRING,
          nullable: true,
          description: "Explicit grade as a string or null if none given",
        },
      },
      required: ["feedback", "grade"],
    },
  },
  required: ["result"],
};

function cleanGradeAndFeedback(parsed) {
  const { feedback, grade } = parsed.result;
  return {
    feedback:
      typeof feedback === "string" && feedback.trim() === "" ? null : feedback,
    grade: typeof grade === "string" && grade.trim() === "" ? null : grade,
  };
}

module.exports = { GradeAndFeedbackSchema, cleanGradeAndFeedback };
