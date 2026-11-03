const express = require("express");
const multer = require("multer");
const { projectDefenseHandler } = require("../api/project-defense");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB per file
    files: 10,
    fields: 20,
  },
});

const router = express.Router();

router.post("/", upload.array("files"), projectDefenseHandler);

module.exports = router;
