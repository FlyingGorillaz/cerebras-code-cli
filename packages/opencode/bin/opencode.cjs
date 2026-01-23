#!/usr/bin/env node
const childProcess = require("child_process")
const fs = require("fs")
const path = require("path")
const os = require("os")

function run(target) {
  const result = childProcess.spawnSync(target, process.argv.slice(2), { stdio: "inherit" })
  if (result.error) { console.error(result.error.message); process.exit(1) }
  process.exit(typeof result.status === "number" ? result.status : 0)
}

const envPath = process.env.CEREBRAS_CLI_BIN_PATH || process.env.OPENCODE_BIN_PATH
if (envPath) run(envPath)

const scriptDir = path.dirname(fs.realpathSync(__filename))
const base = "cerebras-cli-" + ({"darwin":"darwin","linux":"linux","win32":"windows"}[os.platform()] || os.platform()) + "-" + ({"x64":"x64","arm64":"arm64","arm":"arm"}[os.arch()] || os.arch())
const binary = os.platform() === "win32" ? "cerebras-cli.exe" : "cerebras-cli"

function findBinary(startDir) {
  let current = startDir
  while (true) {
    const modules = path.join(current, "node_modules")
    if (fs.existsSync(modules)) {
      for (const entry of fs.readdirSync(modules)) {
        if (entry.startsWith(base)) {
          const candidate = path.join(modules, entry, "bin", binary)
          if (fs.existsSync(candidate)) return candidate
        }
      }
    }
    const parent = path.dirname(current)
    if (parent === current) return
    current = parent
  }
}

const resolved = findBinary(scriptDir)
if (!resolved) { console.error("Binary not found for " + base); process.exit(1) }
run(resolved)
