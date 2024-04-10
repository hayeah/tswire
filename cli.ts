#!/usr/bin/env bun

import ts from "typescript"
console.log("hello bun:", Bun.version)
console.log("hello ts:", ts.version)

// just run wire.ts...
import "./wire.ts"
