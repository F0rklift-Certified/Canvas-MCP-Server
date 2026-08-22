import type { CanvasClient } from "./canvas-client.js";

/**
 * Build a fake CanvasClient for unit tests. Pass in only the methods a given
 * handler needs; everything else throws if called unexpectedly, so tests fail
 * loudly when a handler reaches for the network in a way they didn't stub.
 */
export function makeFakeClient(overrides: Partial<CanvasClient>): CanvasClient {
  const notStubbed = (name: string) => () => {
    throw new Error(`CanvasClient.${name} was called but not stubbed in this test`);
  };

  const base = {
    getCourses: notStubbed("getCourses"),
    getModules: notStubbed("getModules"),
    getModuleItems: notStubbed("getModuleItems"),
    getFiles: notStubbed("getFiles"),
    getFile: notStubbed("getFile"),
    getFileUrlFromModules: notStubbed("getFileUrlFromModules"),
    getAssignments: notStubbed("getAssignments"),
    getAssignment: notStubbed("getAssignment"),
    getPage: notStubbed("getPage"),
    getPages: notStubbed("getPages"),
    extractFileText: notStubbed("extractFileText"),
  };

  return { ...base, ...overrides } as unknown as CanvasClient;
}

/**
 * Handlers return MCP content blocks. The list/detail tools serialize JSON into
 * the first text block; this pulls that back out and parses it.
 */
export function parseJsonResult(result: unknown): any {
  const text = (result as { content: { type: string; text: string }[] }).content[0].text;
  return JSON.parse(text);
}

/** For handlers that return formatted (non-JSON) text, just grab the raw text. */
export function textResult(result: unknown): string {
  return (result as { content: { type: string; text: string }[] }).content[0].text;
}
