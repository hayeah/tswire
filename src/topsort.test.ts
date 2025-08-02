import { expect, test } from "bun:test";
import { topologicalSort2 as topologicalSort } from "./topsort"; // Assume your function is exported from here

test("Simple Dependency", () => {
  const graph = new Map([
    ["A", ["B"]],
    ["B", []],
  ]);
  const result = topologicalSort("A", graph);
  expect(result).toEqual(["B", "A"]);
});

test("Multiple Dependencies", () => {
  const graph = new Map([
    ["A", ["B", "C"]],
    ["B", ["D"]],
    ["C", ["D"]],
    ["D", []],
  ]);
  const result = topologicalSort("A", graph);
  expect(result).toEqual(["D", "B", "C", "A"]);
});

test("Cycle Detection", () => {
  const graph = new Map([
    ["A", ["B"]],
    ["B", ["C"]],
    ["C", ["A"]],
  ]);
  expect(() => topologicalSort("A", graph)).toThrow("Cycle detected");
});

test("No Dependencies", () => {
  const graph = new Map([["A", []]]);
  const result = topologicalSort("A", graph);
  expect(result).toEqual(["A"]);
});

test("Larger Graph with Mixed Dependencies", () => {
  const graph = new Map([
    ["A", ["B", "C"]],
    ["B", ["D", "E"]],
    ["C", ["F"]],
    ["D", []],
    ["E", []],
    ["F", []],
  ]);

  const result = topologicalSort("A", graph);
  expect(result).toEqual(["D", "E", "B", "F", "C", "A"]);
});
