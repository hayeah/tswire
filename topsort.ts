// given a graph, return the list of dependencies for a node
export function topologicalSort2(
  node: string,
  graph: Map<string, string[]>
): string[] {
  const L: string[] = [];
  const permanentMarks = new Set<string>();
  const temporaryMarks = new Set<string>();

  function visit(targetNode: string) {
    if (permanentMarks.has(targetNode)) {
      return;
    }
    if (temporaryMarks.has(targetNode)) {
      throw new Error("Cycle detected");
    }

    temporaryMarks.add(targetNode);

    const dependencies = graph.get(targetNode) || [];
    for (const dependency of dependencies) {
      visit(dependency);
    }

    temporaryMarks.delete(targetNode);
    permanentMarks.add(targetNode);
    L.unshift(targetNode);
  }

  visit(node);

  return L.reverse();
}

export function topologicalSort(
  node: string,
  graph: Map<string, Set<string>>
): string[] {
  const L: string[] = [];
  const permanentMarks = new Set<string>();
  const temporaryMarks = new Set<string>();

  function visit(targetNode: string) {
    if (permanentMarks.has(targetNode)) {
      return;
    }
    if (temporaryMarks.has(targetNode)) {
      throw new Error("Cycle detected");
    }

    temporaryMarks.add(targetNode);

    const dependencies = graph.get(targetNode) || [];
    for (const dependency of dependencies) {
      visit(dependency);
    }

    temporaryMarks.delete(targetNode);
    permanentMarks.add(targetNode);
    L.unshift(targetNode);
  }

  visit(node);

  return L.reverse();
}
