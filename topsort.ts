// given a graph, return the list of dependencies for a node
export function topologicalSort2(
  node: string,
  graph: Map<string, string[]>
): string[] {
  const L: string[] = []
  const permanentMarks = new Set<string>()
  const temporaryMarks = new Set<string>()

  function visit(targetNode: string) {
    if (permanentMarks.has(targetNode)) {
      return
    }
    if (temporaryMarks.has(targetNode)) {
      throw new Error("Cycle detected")
    }

    temporaryMarks.add(targetNode)

    const dependencies = graph.get(targetNode) || []
    for (const dependency of dependencies) {
      visit(dependency)
    }

    temporaryMarks.delete(targetNode)
    permanentMarks.add(targetNode)
    L.unshift(targetNode)
  }

  visit(node)

  return L.reverse()
}

export function topologicalSort<T>(node: T, graph: Map<T, Set<T>>): T[] {
  const L: T[] = []
  const permanentMarks = new Set<T>()
  const temporaryMarks = new Set<T>()

  function visit(targetNode: T) {
    if (permanentMarks.has(targetNode)) {
      return
    }
    if (temporaryMarks.has(targetNode)) {
      throw new Error("Cycle detected")
    }

    temporaryMarks.add(targetNode)

    const dependencies = graph.get(targetNode) || []
    for (const dependency of dependencies) {
      visit(dependency)
    }

    temporaryMarks.delete(targetNode)
    permanentMarks.add(targetNode)
    L.unshift(targetNode)
  }

  visit(node)

  return L.reverse()
}
