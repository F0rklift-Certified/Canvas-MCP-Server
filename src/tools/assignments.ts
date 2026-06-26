import { CanvasClient } from "../canvas-client.js";

export const assignmentTools = [
  {
    name: "get_assignments",
    description:
      "List all assignments for a course with due dates, point values, and descriptions. Useful for understanding what topics to focus study on.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "number",
          description: "The Canvas course ID",
        },
      },
      required: ["course_id"],
    },
  },
  {
    name: "get_assignment",
    description:
      "Get the full details of a single assignment — its complete description/instructions and grading rubric. Use this when working on one specific assignment, instead of fetching every assignment in the course.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "number",
          description: "The Canvas course ID",
        },
        assignment_id: {
          type: "number",
          description: "The assignment ID (from get_assignments or get_module_items)",
        },
      },
      required: ["course_id", "assignment_id"],
    },
  },
];

const stripHtml = (html: string) =>
  html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? "";

export async function handleAssignmentTools(
  toolName: string,
  args: Record<string, unknown>,
  client: CanvasClient
) {
  if (toolName === "get_assignments") {
    const courseId = args.course_id as number;
    const assignments = await client.getAssignments(courseId);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            assignments.map((a) => ({
              id: a.id,
              name: a.name,
              due_at: a.due_at,
              points: a.points_possible,
              submission_types: a.submission_types,
              description: stripHtml(a.description).slice(0, 10000),
            })),
            null,
            2
          ),
        },
      ],
    };
  }

  if (toolName === "get_assignment") {
    const courseId = args.course_id as number;
    const assignmentId = args.assignment_id as number;
    const a = await client.getAssignment(courseId, assignmentId);

    const rubric = a.rubric?.map((c) => ({
      criterion: stripHtml(c.description),
      details: c.long_description ? stripHtml(c.long_description) : undefined,
      points: c.points,
      ratings: c.ratings?.map((r) => ({
        rating: stripHtml(r.description),
        points: r.points,
      })),
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: a.id,
              name: a.name,
              due_at: a.due_at,
              points: a.points_possible,
              submission_types: a.submission_types,
              description: stripHtml(a.description),
              rubric: rubric ?? null,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
