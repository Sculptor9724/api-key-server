const { _internal } = require("../api/project-defense");

describe("Project defense validation", () => {
  test("accepts valid PDF file signature and extension", () => {
    const file = {
      originalname: "report.pdf",
      buffer: Buffer.from("%PDF-1.7 sample"),
    };

    expect(_internal.isPdf(file)).toBe(true);
  });

  test("rejects non-PDF extension", () => {
    const file = {
      originalname: "report.docx",
      buffer: Buffer.from("%PDF-1.7 sample"),
    };

    expect(_internal.isPdf(file)).toBe(false);
  });

  test("rejects incorrect PDF magic bytes", () => {
    const file = {
      originalname: "report.pdf",
      buffer: Buffer.from("NOTPDF content"),
    };

    expect(_internal.isPdf(file)).toBe(false);
  });

  test("requires at least one file or repoUrl", () => {
    expect(() => _internal.validateInputOrThrow([], "")).toThrow(
      "Provide at least one PDF file or a repoUrl.",
    );
  });

  test("rejects non-PDF files with required error message", () => {
    const files = [
      {
        originalname: "slides.pptx",
        buffer: Buffer.from("PK"),
        size: 100,
      },
    ];

    expect(() => _internal.validateInputOrThrow(files, "")).toThrow(
      "Only PDF files are supported. Please export your document to PDF.",
    );
  });

  test("rejects total file size above 100 MB", () => {
    const files = [
      {
        originalname: "a.pdf",
        buffer: Buffer.from("%PDF-a"),
        size: 34 * 1024 * 1024,
      },
      {
        originalname: "b.pdf",
        buffer: Buffer.from("%PDF-b"),
        size: 34 * 1024 * 1024,
      },
      {
        originalname: "c.pdf",
        buffer: Buffer.from("%PDF-c"),
        size: 34 * 1024 * 1024,
      },
    ];

    expect(() => _internal.validateInputOrThrow(files, "")).toThrow(
      "Total upload size exceeds 100 MB. Reduce your files and try again.",
    );
  });
});

describe("Project defense prompt", () => {
  test("includes repo content when provided", () => {
    const prompt = _internal.buildQuestionGenerationPrompt(
      {
        learning_goals: "Understand architecture",
        duration: "30",
        description: "Test exam",
      },
      "repo data",
      [],
    );

    expect(prompt).toContain("repo data");
    expect(prompt).not.toContain("PDF report");
  });

  test("includes PDF line when files are present", () => {
    const prompt = _internal.buildQuestionGenerationPrompt(
      {
        learning_goals: "Understand architecture",
        duration: "30",
        description: "Test exam",
      },
      "",
      ["report.pdf"],
    );

    expect(prompt).toContain("PDF report");
    expect(prompt).toContain("report.pdf");
    expect(prompt).toContain("Do not ask generic questions");
  });
});

describe("Project defense Gemini file parts", () => {
  test("creates a Gemini fileData part from an uploaded file", () => {
    const part = _internal.toGeminiFilePart({
      uri: "https://generativelanguage.googleapis.com/v1beta/files/example",
      mimeType: "application/pdf",
    });

    expect(part).toEqual({
      fileData: {
        fileUri:
          "https://generativelanguage.googleapis.com/v1beta/files/example",
        mimeType: "application/pdf",
      },
    });
  });

  test("rejects uploaded files without a Gemini URI", () => {
    expect(() =>
      _internal.toGeminiFilePart({ mimeType: "application/pdf" }),
    ).toThrow("Uploaded file is missing Gemini file URI");
  });
});
