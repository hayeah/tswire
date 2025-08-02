import path from "node:path";
import * as ts from "typescript";
import type { AliasType, WireTypeChecker } from "./types";
import { isAliasType } from "./types";

export function findSourceFile(node: ts.Node): ts.SourceFile {
  let current: ts.Node = node;
  while (current && !ts.isSourceFile(current)) {
    current = current.parent;
  }
  return current as ts.SourceFile;
}

export function relativeImportPath(
  outputModuleFile: string,
  declarationFileName: string,
): string {
  // const declarationFileName = declaration.getSourceFile().fileName;
  // Calculate the relative path from the declaration file to the outputModuleFile
  let importPath = path
    .relative(path.dirname(outputModuleFile), declarationFileName)
    // Remove the file extension
    .replace(/\.\w+$/, "")
    // Ensure import path format (replace \ with / for non-UNIX systems)
    .replace(/\\/g, "/");
  // If the path does not start with '.', add './' to make it a relative path
  if (!importPath.startsWith(".")) {
    importPath = `./${importPath}`;
  }

  return importPath;
}

export function typeName(type: ts.Type): string {
  if (isAliasType(type)) {
    return type.tswireTypeAliasSymbol.name;
  }

  if (type.symbol) {
    return type.symbol.name;
  }

  if ("intrinsicName" in type) {
    return type.intrinsicName as string;
  }

  return "";
}

export function canonicalSymbol(
  type: ts.Type,
  checker: ts.TypeChecker,
): ts.Symbol | undefined {
  let sym = isAliasType(type) ? type.tswireTypeAliasSymbol : type.symbol;
  if (!sym) return sym;

  // Collapse import-aliases to their original declaration
  if (sym.flags & ts.SymbolFlags.Alias) {
    sym = checker.getAliasedSymbol(sym);
  }
  return sym;
}

export function monkeyPatchTypeChecker(
  checker: ts.TypeChecker,
): WireTypeChecker {
  const wc = Object.create(checker);

  const cache = new Map<ts.Symbol, ts.Type>();

  // getTypeAtLocationPreserveReference returns the type, with type alias symbol
  // if applicable. It resolves to the same object instance for the same aliased
  // type symbol, to preserve mapping identity.
  //
  // This is necessary because there does not seem to be a way to get an
  // intermedia ts.Type for the aliasing symbol.
  wc.getTypeAtLocationWithAliasSymbol = (node: ts.Node): ts.Type => {
    // getTypeAtLocation gives the resolved type for type aliases
    let type = checker.getTypeAtLocation(node);

    if (ts.isTypeReferenceNode(node)) {
      const symbol = checker.getSymbolAtLocation(node.typeName);

      if (!symbol) {
        throw new Error("symbol not found");
      }

      const isIntrinsic = type.symbol === undefined;

      // idea: detect if the resolved type has a different symbol from the type
      // name we are looking at right now, then it's a type alias.
      const isTypeAlias = isIntrinsic || type.symbol !== symbol;

      if (!isTypeAlias) {
        return type;
      }

      // need to return the same wrapped ts.Type for this symbol, so object
      // identity works for using ts.Type as key in Map
      if (cache.has(symbol)) {
        const cachedType = cache.get(symbol);
        if (!cachedType) {
          throw new Error("Cached type not found");
        }
        return cachedType;
      }

      // Notes on the type returned by checker. No immediate type could be
      // extracted from symbols, it seems. For a type alias, the checker always
      // gives the resolved underlying type.
      //
      // const aliasDeclaration: ts.TypeAliasDeclaration =
      //   symbol.declarations![0] as any
      //   this.checker.getTypeAtLocation(aliasDeclaration.name) // TypeObject
      //   number this.checker.getTypeFromTypeNode(node) // TypeObject number
      //   this.checker.getTypeFromTypeNode(aliasDeclaration.type) // TypeObject
      //   number this.checker.getTypeOfSymbol(symbol) // TypeObject error
      //   this.checker.getDeclaredTypeOfSymbol(symbol) // TypeObject number

      // the ts.Type interface in fact has aliasSymbol, but that doesn't seem to
      // get populated for type aliases.
      const aliasedType: AliasType = Object.create(type, {
        tswireTypeAliasSymbol: {
          value: symbol,
          // writable: true,
          // enumerable: true,
          // configurable: true
        },
      });

      cache.set(symbol, aliasedType);

      type = aliasedType;
    }

    return type;
  };

  return wc;
}

// `wireOutputPath` generates a new file path with `_wire` appended to the
// filename before the extension, using Node.js `path` module for handling file
// paths. This approach is more robust and handles edge cases well, such as
// files without extensions. `inputFilePath`: A string representing the path to
// the input file. Returns a string representing the path to the output file
// with `_wire` appended to the filename.
export function wireOutputPath(inputFilePath: string): string {
  // Extract the directory, filename without extension, and extension from the input path.
  const dirname = path.dirname(inputFilePath);
  const extname = path.extname(inputFilePath);
  const basename = path.basename(inputFilePath, extname);

  // Append '_gen' to the basename, then reconstruct the path.
  const outputFileName = `${basename}_gen${extname}`;
  const outputFilePath = path.join(dirname, outputFileName);

  return outputFilePath;
}
