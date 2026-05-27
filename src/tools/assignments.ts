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
];

export async function handleAssignmentTools(
  toolName: string,
  args: Record<string, unknown>,
  client: CanvasClient
) {
  if (toolName === "get_assignments") {
    const courseId = args.course_id as number;
    const assignments = await client.getAssignments(courseId);

    // Strip HTML tags from descriptions for cleaner text
    const stripHtml = (html: string) =>
      html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? "";

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
              description: stripHtml(a.description).slice(0, 500),
            })),
            null,
            2
          ),
        },
      ],
    };
  }
}
