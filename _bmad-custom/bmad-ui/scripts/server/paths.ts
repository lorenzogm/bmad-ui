import path from "node:path"
import { fileURLToPath } from "node:url"

const __serverDirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : fileURLToPath(new URL(".", import.meta.url))

export const projectRoot = path.resolve(__serverDirname, "..", "..", "..", "..")
export const artifactsRoot = path.join(projectRoot, "_bmad-output")
export const agentsDir = path.join(projectRoot, "_bmad-custom", "agents")
export const sprintStatusFile = path.join(
  artifactsRoot,
  "implementation-artifacts",
  "sprint-status.yaml",
)
