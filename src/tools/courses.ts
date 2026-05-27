import { CanvasClient } from "../canvas-client.js";

export const courseTools = [
  {
    name: "get_courses",
    description:
      "List all active enrolled courses for the current Canvas user. Returns course IDs, names, and codes needed for other tools.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

export async function handleCourseTools(
  toolName: string,
  _args: Record<string, unknown>,
  client: CanvasClient
) {
  if (toolName === "get_courses") {
    const courses = await client.getCourses();
    const formatted = courses
      .filter((c) => c.workflow_state === "available")
      .map((c) => ({
        id: c.id,
        name: c.name,
        code: c.course_code,
      }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(formatted, null, 2),
        },
      ],
    };
  }
}
