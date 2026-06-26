import { test } from "node:test";
import assert from "node:assert/strict";

import { handleCourseTools } from "./courses.js";
import { makeFakeClient, parseJsonResult } from "../test-utils.js";
import type { Course } from "../canvas-client.js";

const course = (over: Partial<Course>): Course => ({
  id: 1,
  name: "Course",
  course_code: "C1",
  enrollment_term_id: 1,
  workflow_state: "available",
  ...over,
});

test("get_courses returns id, name, and code for each course", async () => {
  const client = makeFakeClient({
    getCourses: async () => [course({ id: 7, name: "Biology", course_code: "BIO101" })],
  });

  const result = await handleCourseTools("get_courses", {}, client);
  const parsed = parseJsonResult(result);

  assert.deepEqual(parsed, [{ id: 7, name: "Biology", code: "BIO101" }]);
});

test("get_courses filters out courses that are not available", async () => {
  const client = makeFakeClient({
    getCourses: async () => [
      course({ id: 1, workflow_state: "available" }),
      course({ id: 2, workflow_state: "completed" }),
      course({ id: 3, workflow_state: "unpublished" }),
    ],
  });

  const result = await handleCourseTools("get_courses", {}, client);
  const parsed = parseJsonResult(result);

  assert.deepEqual(
    parsed.map((c: { id: number }) => c.id),
    [1]
  );
});
