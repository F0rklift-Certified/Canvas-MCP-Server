import { test } from "node:test";
import assert from "node:assert/strict";

import { handlePageTools } from "./pages.js";
import { makeFakeClient, parseJsonResult, textResult } from "../test-utils.js";
import type { Page } from "../canvas-client.js";

const page = (over: Partial<Page>): Page => ({
  page_id: "1",
  url: "week-1-notes",
  title: "Week 1 Notes",
  body: "<p>Hello</p>",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  ...over,
});

test("get_pages returns title, url, and updated_at", async () => {
  const client = makeFakeClient({
    getPages: async (courseId: number) => {
      assert.equal(courseId, 4);
      return [page({ title: "Syllabus", url: "syllabus" })];
    },
  });

  const result = await handlePageTools("get_pages", { course_id: 4 }, client);

  assert.deepEqual(parseJsonResult(result), [
    { title: "Syllabus", url: "syllabus", updated_at: "2026-01-02T00:00:00Z" },
  ]);
});

test("get_page_content strips HTML and decodes entities", async () => {
  const client = makeFakeClient({
    getPage: async (courseId: number, pageUrl: string) => {
      assert.equal(courseId, 4);
      assert.equal(pageUrl, "week-1-notes");
      return page({
        title: "Week 1 Notes",
        body: "<h1>Topic</h1><p>Acids&nbsp;&amp;&nbsp;bases are &lt;important&gt;</p>",
      });
    },
  });

  const result = await handlePageTools(
    "get_page_content",
    { course_id: 4, page_url: "week-1-notes" },
    client
  );
  const text = textResult(result);

  assert.match(text, /# Week 1 Notes/);
  assert.match(text, /Acids & bases are <important>/);
  assert.doesNotMatch(text, /<h1>|<p>|&nbsp;|&amp;/);
});
