import { CanvasClient } from "../canvas-client.js";

export const moduleTools = [
  {
    name: "get_modules",
    description:
      "Get the list of modules (topics/weeks) for a course. Use this to understand how the course is structured before fetching specific content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "number",
          description: "The Canvas course ID (from get_courses)",
        },
      },
      required: ["course_id"],
    },
  },
  {
    name: "get_module_items",
    description:
      "Get all items within a specific module — files, pages, assignments, quizzes, and links. Use this to find content IDs to fetch with other tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        course_id: {
          type: "number",
          description: "The Canvas course ID",
        },
        module_id: {
          type: "number",
          description: "The module ID (from get_modules)",
        },
      },
      required: ["course_id", "module_id"],
    },
  },
];

export async function handleModuleTools(
  toolName: string,
  args: Record<string, unknown>,
  client: CanvasClient
) {
  if (toolName === "get_modules") {
    const courseId = args.course_id as number;
    const modules = await client.getModules(courseId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            modules.map((m) => ({
              id: m.id,
              name: m.name,
              position: m.position,
              items_count: m.items_count,
            })),
            null,
            2
          ),
        },
      ],
    };
  }

  if (toolName === "get_module_items") {
    const courseId = args.course_id as number;
    const moduleId = args.module_id as number;
    const items = await client.getModuleItems(courseId, moduleId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            items.map((item) => ({
              id: item.id,
              title: item.title,
              type: item.type,
              content_id: item.content_id,
              page_url: item.page_url,
              url: item.url,
            })),
            null,
            2
          ),
        },
      ],
    };
  }
}
