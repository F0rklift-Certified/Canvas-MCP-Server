import { test } from "node:test";
import assert from "node:assert/strict";

import { handleModuleTools } from "./modules.js";
import { makeFakeClient, parseJsonResult } from "../test-utils.js";
import type { Module, ModuleItem } from "../canvas-client.js";

test("get_modules maps id, name, position, and items_count", async () => {
  const modules: Module[] = [
    { id: 10, name: "Week 1", position: 1, items_count: 4, items_url: "x" },
  ];
  const client = makeFakeClient({
    getModules: async (courseId: number) => {
      assert.equal(courseId, 99);
      return modules;
    },
  });

  const result = await handleModuleTools("get_modules", { course_id: 99 }, client);

  assert.deepEqual(parseJsonResult(result), [
    { id: 10, name: "Week 1", position: 1, items_count: 4 },
  ]);
});

test("get_module_items maps the fields needed to fetch content", async () => {
  const items: ModuleItem[] = [
    {
      id: 5,
      title: "Lecture 1",
      type: "File",
      content_id: 555,
      page_url: undefined,
      url: "api/url",
    },
    {
      id: 6,
      title: "Notes",
      type: "Page",
      page_url: "week-1-notes",
      url: "api/url2",
    },
  ];
  const client = makeFakeClient({
    getModuleItems: async (courseId: number, moduleId: number) => {
      assert.equal(courseId, 99);
      assert.equal(moduleId, 10);
      return items;
    },
  });

  const result = await handleModuleTools(
    "get_module_items",
    { course_id: 99, module_id: 10 },
    client
  );

  assert.deepEqual(parseJsonResult(result), [
    { id: 5, title: "Lecture 1", type: "File", content_id: 555, url: "api/url" },
    { id: 6, title: "Notes", type: "Page", page_url: "week-1-notes", url: "api/url2" },
  ]);
});
