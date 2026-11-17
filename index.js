process.env.TZ = "Europe/Copenhagen";

const express = require("express");
const cors = require("cors"); // Import the cors middleware
require("dotenv").config(); // Make sure to install dotenv: npm install dotenv
const getExaminerQuestionsRouter = require("./router/get-examiner-questions");
const getGradeAndFeedbackRouter = require("./router/get-grade-and-feedback");
const tokenRouter = require("./router/token");
const canConnectRouter = require("./router/can-connect");
const projectDefenseRouter = require("./router/project-defense");
const deleteMeRouter = require("./router/delete-me");
const authenticate = require("./middleware/auth");

const app = express();

// Configurable body size limits (default 1mb -> increased for base64 images)
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "10mb"; // base64 images can be large
const FORM_BODY_LIMIT = process.env.FORM_BODY_LIMIT || "10mb";

const whitelist = [
  "https://behu-kea.github.io",
  "https://mineksamen.dk",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // allow requests with no Origin header (e.g. curl, mobile apps)
      if (!origin) return cb(null, true);
      return whitelist.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS"));
    },
    credentials: true, // if you need cookies / auth headers
    preflightContinue: true, // Pass preflight response to next handler
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

// Handle OPTIONS requests without authentication
app.options("*", (req, res) => {
  res.sendStatus(200);
});

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: FORM_BODY_LIMIT }));

// Use routers
app.use("/auth-token", authenticate, tokenRouter);
app.use("/can-connect", authenticate, canConnectRouter);
app.use("/get-examiner-questions", authenticate, getExaminerQuestionsRouter);
app.use("/get-grade-and-feedback", authenticate, getGradeAndFeedbackRouter);
app.use("/project-defense", authenticate, projectDefenseRouter);
app.use("/api/me", deleteMeRouter);

// Central error handler (including payload too large)
app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      error:
        "Payload too large. Consider using multipart/form-data with an 'image' file field instead of large base64 JSON.",
      limits: {
        json_limit: JSON_BODY_LIMIT,
        form_limit: FORM_BODY_LIMIT,
      },
    });
    
  }
  if (err) {
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
  next();
});

const PORT = process.env.PORT || 3002;

// For local development
if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
