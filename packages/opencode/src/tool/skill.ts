import path from "path"
import z from "zod"
import { Tool } from "./tool"
import { Skill } from "../skill"
import { ConfigMarkdown } from "../config/markdown"
import { Permission } from "../permission"
import { Config } from "../config/config"

export const SkillTool = Tool.define("skill", async () => {
  const skills = await Skill.all()

  const description =
    skills.length === 0
      ? "Load a skill to get detailed instructions for a specific task. No skills are currently available."
      : [
          "Load a skill to get detailed instructions for a specific task.",
          "Skills provide specialized knowledge and step-by-step guidance.",
          "Use this when a task matches an available skill's description.",
          "Only the skills listed here are available:",
          "<available_skills>",
          ...skills.flatMap((skill) => [
            `  <skill>`,
            `    <name>${skill.name}</name>`,
            `    <description>${skill.description}</description>`,
            `  </skill>`,
          ]),
          "</available_skills>",
        ].join(" ")

  const examples = skills
    .map((skill) => `'${skill.name}'`)
    .slice(0, 3)
    .join(", ")
  const hint = examples.length > 0 ? ` (e.g., ${examples}, ...)` : ""

  const parameters = z.object({
    name: z.string().describe(`The skill identifier from available_skills${hint}`),
  })

  return {
    description,
    parameters,
    async execute(params: z.infer<typeof parameters>, ctx) {
      const skill = await Skill.get(params.name)

      if (!skill) {
        const available = await Skill.all().then((x) => x.map((s) => s.name).join(", "))
        throw new Error(`Skill "${params.name}" not found. Available skills: ${available || "none"}`)
      }

      // Ask for permission (webfetch permission controls skill loading)
      const config = await Config.get()
      if (config.permission?.webfetch === "ask") {
        await Permission.ask({
          type: "skill",
          pattern: params.name,
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          callID: ctx.callID,
          title: `Load skill: ${skill.name}`,
          metadata: {
            name: skill.name,
            description: skill.description,
          },
        })
      }

      // Load and parse skill content
      const parsed = await ConfigMarkdown.parse(skill.location)
      const dir = path.dirname(skill.location)

      // Format output similar to plugin pattern
      const output = [`## Skill: ${skill.name}`, "", `**Base directory**: ${dir}`, "", parsed.content.trim()].join("\n")

      return {
        title: `Loaded skill: ${skill.name}`,
        output,
        metadata: {
          name: skill.name,
          dir,
        },
      }
    },
  }
})
