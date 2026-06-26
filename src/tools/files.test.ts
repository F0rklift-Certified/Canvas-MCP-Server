import { test } from "node:test";
import assert from "node:assert/strict";

import { handleFileTools } from "./files.js";
import { makeFakeClient, parseJsonResult, textResult } from "../test-utils.js";
import type { CanvasFile } from "../canvas-client.js";

const file = (over: Partial<CanvasFile>): CanvasFile => ({
  id: 1,
  display_name: "Lecture.pdf",
  filename: "lecture.pdf",
  content_type: "application/pdf",
  url: "https://canvas/files/1",
  size: 2048,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  ...over,
});

test("get_files returns metadata with size converted to KB", async () => {
  const client = makeFakeClient({
    getFiles: async (courseId: number) => {
      assert.equal(courseId, 3);
      return [file({ id: 12, display_name: "Slides.pptx", size: 1536 })];
    },
  });

  const result = await handleFileTools("get_files", { course_id: 3 }, client);
  const parsed = parseJsonResult(result);

  assert.equal(parsed[0].id, 12);
  assert.equal(parsed[0].name, "Slides.pptx");
  assert.equal(parsed[0].size_kb, 2); // 1536 / 1024 rounded
});

test("get_file_content prepends a header and returns extracted text", async () => {
  const client = makeFakeClient({
    getFile: async (fileId: number) => {
      assert.equal(fileId, 12);
      return file({ id: 12, display_name: "Lecture.pdf" });
    },
    extractFileText: async () => "Mitochondria is the powerhouse of the cell.",
  });

  const result = await handleFileTools("get_file_content", { file_id: 12 }, client);
  const text = textResult(result);

  assert.match(text, /# Lecture\.pdf/);
  assert.match(text, /Type: application\/pdf/);
  assert.match(text, /powerhouse of the cell/);
});

test("get_file_content truncates very large files", async () => {
  const big = "a".repeat(60_000);
  const client = makeFakeClient({
    getFile: async () => file({}),
    extractFileText: async () => big,
  });

  const result = await handleFileTools("get_file_content", { file_id: 1 }, client);
  const text = textResult(result);

  assert.match(text, /content truncated, file too large/);
  // header + 50k of content + truncation note, but nowhere near the full 60k
  assert.ok(text.length < 60_000);
});
