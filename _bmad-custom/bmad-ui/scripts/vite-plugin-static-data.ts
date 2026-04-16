import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import type { Plugin } from "vite"
import {
  STORY_WORKFLOW_STEPS,
  buildAnalyticsPayload,
  buildOverviewPayload,
  buildSessionDetailPayload,
  deriveStoryStepStateFromStatus,
  epicsFile,
  fallbackSummary,
  findStoryMarkdown,
  getCompletedSessionSummary,
  getEpicMetadataFromMarkdown,
  getStoryContentFromEpics,
  readRuntimeStateFile,
  setBuildMode,
} from "./agent-server"

/**
 * Vite plugin that reads project data from _bmad-output and _bmad-custom at
 * build time and emits static JSON directly into dist/data/ — no intermediate
 * files on disk.
 */
function staticDataPlugin(): Plugin {
  return {
    name: "bmad-static-data",
    apply: "build",
    async generateBundle() {
      setBuildMode(true)

      const emit = (fileName: string, data: unknown) => {
        this.emitFile({
          type: "asset",
          fileName: `data/${fileName}`,
          source: JSON.stringify(data),
        })
      }

      // ── Overview ───────────────────────────────────────────
      const overview = await buildOverviewPayload()
      emit("overview.json", overview)

      // ── Analytics ──────────────────────────────────────────
      const analytics = await buildAnalyticsPayload()
      emit("analytics.json", analytics)

      // ── Epic details ───────────────────────────────────────
      const epicsContent = existsSync(epicsFile) ? await readFile(epicsFile, "utf8") : ""
      const runtimeState = await readRuntimeStateFile()

      for (const epic of overview.sprintOverview.epics) {
        const epicMeta = epicsContent
          ? getEpicMetadataFromMarkdown(epicsContent, epic.number)
          : { name: "", description: "" }

        const stories = overview.sprintOverview.stories
          .filter((story) => Number(story.id.split("-")[0]) === epic.number)
          .sort((a, b) => (a.id > b.id ? 1 : -1))

        emit(`epic/epic-${epic.number}.json`, {
          epic: {
            id: epic.id,
            number: epic.number,
            name: epicMeta.name,
            description: epicMeta.description,
            status: epic.status,
            storyCount: epic.storyCount,
            byStoryStatus: epic.byStoryStatus,
          },
          stories,
        })
      }

      // ── Story details + previews ───────────────────────────
      for (const story of overview.sprintOverview.stories) {
        const markdown = await findStoryMarkdown(story.id)
        const sessions = (runtimeState?.sessions || [])
          .filter((s) => s.storyId === story.id)
          .filter((s) => s.status !== "planned")
          .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))

        emit(`story/${story.id}.json`, {
          story: {
            id: story.id,
            status: story.status,
            markdownPath: markdown?.path || null,
            markdownContent: markdown?.content || null,
          },
          steps: await Promise.all(
            STORY_WORKFLOW_STEPS.map(async (step) => {
              const state = deriveStoryStepStateFromStatus(story.status, step.skill)
              const generatedSummary = await getCompletedSessionSummary(
                runtimeState?.sessions || [],
                story.id,
                step.skill
              )
              return {
                skill: step.skill,
                label: step.label,
                state,
                summary:
                  generatedSummary || fallbackSummary(step.skill, state, markdown?.path || null),
              }
            })
          ),
          sessions,
          externalProcesses: [],
        })

        // Story preview
        let planningContent: { title: string; content: string } | null = null
        if (existsSync(epicsFile)) {
          try {
            planningContent = getStoryContentFromEpics(epicsContent, story.id)
          } catch {
            // ignore
          }
        }

        const implMarkdown = await findStoryMarkdown(story.id)
        emit(`story-preview/${story.id}.json`, {
          storyId: story.id,
          planning: planningContent
            ? { title: planningContent.title, content: planningContent.content }
            : null,
          implementation: implMarkdown
            ? { path: implMarkdown.path, content: implMarkdown.content }
            : null,
        })
      }

      // ── Session details ────────────────────────────────────
      for (const session of runtimeState?.sessions || []) {
        if (session.status === "planned") {
          continue
        }
        try {
          const payload = await buildSessionDetailPayload(session.id)
          if (payload) {
            emit(`session/${session.id}.json`, payload)
          }
        } catch {
          // skip sessions that can't be built
        }
      }
    },
  }
}

export { staticDataPlugin }
