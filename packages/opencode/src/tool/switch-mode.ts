import z from "zod"
import { Tool } from "./tool"

export const SwitchModeTool = Tool.define(
  "switch_mode",
  async () => ({
    description: `Switch to a different mode. Call this when the user signals readiness to proceed:
- "go", "do it", "build it", "implement", "execute", "start", "let's do it", "approved"
- User explicitly approves the plan
- Plan is complete and user wants implementation

Modes: "build" (write code), "plan" (analyze/design), "docs" (documentation)`,
    parameters: z.object({
      mode: z.enum(["build", "plan", "docs"]).describe("The mode to switch to"),
      reason: z.string().describe("Brief reason for switching (shown to user)"),
    }),
    execute: async (args, ctx) => {
      // Store the switch request in the context metadata
      // The loop will check for this and handle the switch
      ctx.metadata({
        title: `Switching to ${args.mode} mode`,
        metadata: {
          switch_mode: args.mode,
          switch_reason: args.reason,
        },
      })

      return {
        title: `Switching to ${args.mode} mode`,
        metadata: {
          switch_mode: args.mode,
          switch_reason: args.reason,
        },
        output: `Mode switch to "${args.mode}" scheduled. Reason: ${args.reason}`,
      }
    },
  }),
)
