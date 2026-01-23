import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"
import { Skill } from "../../../skill"

export const SkillCommand = cmd({
  command: "skill",
  describe: "List all discovered skills",
  async handler() {
    await bootstrap(process.cwd(), async () => {
      const skills = await Skill.all()
      
      console.log("\n=== Discovered Skills ===\n")
      
      if (skills.length === 0) {
        console.log("No skills found.")
        console.log("\nSkills are loaded from:")
        console.log("  - .opencode/skill/<name>/SKILL.md")
        console.log("  - .opencode/skills/<name>/SKILL.md")
        console.log("  - ~/.config/opencode/skill/<name>/SKILL.md")
        console.log("  - .claude/skills/<name>/SKILL.md")
        console.log("  - ~/.claude/skills/<name>/SKILL.md")
        return
      }

      for (const skill of skills) {
        console.log(`📚 ${skill.name}`)
        console.log(`   Description: ${skill.description}`)
        console.log(`   Location: ${skill.location}`)
        console.log()
      }

      console.log(`Total: ${skills.length} skill(s) found`)
    })
  },
})

