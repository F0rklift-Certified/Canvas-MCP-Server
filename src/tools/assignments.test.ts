import { test } from "node:test";
import assert from "node:assert/strict";

import { handleAssignmentTools } from "./assignments.js";
import { makeFakeClient, parseJsonResult } from "../test-utils.js";
import type { Assignment } from "../canvas-client.js";

const assignment = (over: Partial<Assignment>): Assignment => ({
  id: 1,
  name: "Essay 1",
  description: "<p>Write <b>500</b> words</p>",
  due_at: "2026-07-01T23:59:00Z",
  points_possible: 100,
  submission_types: ["online_text_entry"],
  course_id: 4,
  ...over,
});

test("get_assignments returns metadata only, without descriptions", async () => {
  const client = makeFakeClient({
    getAssignments: async (courseId: number) => {
      assert.equal(courseId, 4);
      return [assignment({ id: 2, name: "Lab Report" })];
    },
  });

  const result = await handleAssignmentTools("get_assignments", { course_id: 4 }, client);
  const parsed = parseJsonResult(result);

  assert.deepEqual(parsed, [
    {
      id: 2,
      name: "Lab Report",
      due_at: "2026-07-01T23:59:00Z",
      points: 100,
      submission_types: ["online_text_entry"],
    },
  ]);
  assert.equal("description" in parsed[0], false);
});

test("get_assignment_description returns the full HTML-stripped description", async () => {
  const client = makeFakeClient({
    getAssignment: async (courseId: number, assignmentId: number) => {
      assert.equal(courseId, 4);
      assert.equal(assignmentId, 2);
      return assignment({ id: 2, description: "<p>Write a <b>full</b> essay</p>" });
    },
  });

  const result = await handleAssignmentTools(
    "get_assignment_description",
    { course_id: 4, assignment_id: 2 },
    client
  );
  const parsed = parseJsonResult(result);

  assert.equal(parsed.id, 2);
  assert.equal(parsed.description, "Write a full essay");
  assert.equal(parsed.rubric, null);
});

test("get_assignment_description formats the rubric when present", async () => {
  const client = makeFakeClient({
    getAssignment: async () =>
      assignment({
        id: 2,
        rubric: [
          {
            id: "r1",
            description: "<b>Clarity</b>",
            long_description: "<p>Is it clear?</p>",
            points: 10,
            ratings: [
              { description: "Excellent", points: 10 },
              { description: "Poor", points: 0 },
            ],
          },
        ],
      }),
  });

  const result = await handleAssignmentTools(
    "get_assignment_description",
    { course_id: 4, assignment_id: 2 },
    client
  );
  const parsed = parseJsonResult(result);

  assert.deepEqual(parsed.rubric, [
    {
      criterion: "Clarity",
      details: "Is it clear?",
      points: 10,
      ratings: [
        { rating: "Excellent", points: 10 },
        { rating: "Poor", points: 0 },
      ],
    },
  ]);
});
