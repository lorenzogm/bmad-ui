import { createRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { EpicDetailResponse } from "../types";
import { rootRoute } from "./__root";

const STORY_TICKET_REGEX = /^(\d+)-(\d+)-/;

function parseStoryTicket(storyId: string): { epic: number; story: number } {
  const match = storyId.match(STORY_TICKET_REGEX);
  if (!match) {
    return { epic: Number.POSITIVE_INFINITY, story: Number.POSITIVE_INFINITY };
  }
  return {
    epic: Number(match[1]),
    story: Number(match[2]),
  };
}

function deriveStoryStepState(
  storyStatus: string,
  step: "bmad-create-story" | "bmad-dev-story" | "bmad-code-review"
): "not-started" | "running" | "completed" {
  if (storyStatus === "done") {
    return "completed";
  }

  if (step === "bmad-create-story") {
    return storyStatus === "backlog" ? "not-started" : "completed";
  }

  if (step === "bmad-dev-story") {
    if (storyStatus === "backlog" || storyStatus === "ready-for-dev") {
      return "not-started";
    }
    return storyStatus === "in-progress" ? "running" : "completed";
  }

  if (storyStatus === "review") {
    return "running";
  }

  return "not-started";
}

function EpicDetailPage() {
  const { epicId } = useParams({ from: "/epic/$epicId" });
  const [data, setData] = useState<EpicDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideFinishedStories, setHideFinishedStories] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch(`/api/epic/${encodeURIComponent(epicId)}`);
        if (!response.ok) {
          throw new Error(`epic detail request failed: ${response.status}`);
        }
        const payload = (await response.json()) as EpicDetailResponse;
        if (mounted) {
          setData(payload);
          setError(null);
          setLoading(false);
        }
      } catch (epicError) {
        if (mounted) {
          setError(String(epicError));
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [epicId]);

  const stories = useMemo(
    () =>
      [...(data?.stories || [])].sort((a, b) => {
        const aTicket = parseStoryTicket(a.id);
        const bTicket = parseStoryTicket(b.id);

        if (aTicket.epic !== bTicket.epic) {
          return aTicket.epic - bTicket.epic;
        }

        if (aTicket.story !== bTicket.story) {
          return aTicket.story - bTicket.story;
        }

        return a.id.localeCompare(b.id);
      }),
    [data]
  );

  const filteredStories = useMemo(() => {
    if (!hideFinishedStories) {
      return stories;
    }

    return stories.filter((story) => story.status !== "done");
  }, [hideFinishedStories, stories]);

  if (loading) {
    return <main className="screen loading">Loading epic detail...</main>;
  }

  if (error || !data) {
    return (
      <main className="screen loading">
        <p>{error || "Epic not found"}</p>
        <Link to="/">Back to home</Link>
      </main>
    );
  }

  return (
    <main className="screen">
      <section className="panel reveal">
        <h2>Epic Summary</h2>
        <p className="eyebrow">Epic Detail</p>
        <h1>{data.epic.id}</h1>
        <p className="subtitle">Current status: {data.epic.status}</p>
        <p>
          <Link to="/">Back to home</Link>
        </p>
      </section>

      <section className="panel reveal delay-1">
        <h2>Stories In This Epic</h2>
        <label className="filter-toggle">
          <input
            checked={hideFinishedStories}
            onChange={(event) => setHideFinishedStories(event.target.checked)}
            type="checkbox"
          />
          Hide 100% finished stories
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Story</th>
                <th>Create Story</th>
                <th>Dev Story</th>
                <th>Code Review</th>
              </tr>
            </thead>
            <tbody>
              {filteredStories.map((story) => (
                <tr key={story.id}>
                  <td>
                    <Link params={{ storyId: story.id }} to="/story/$storyId">
                      {story.id}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`step-badge step-${deriveStoryStepState(story.status, "bmad-create-story")}`}
                    >
                      {deriveStoryStepState(story.status, "bmad-create-story")}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`step-badge step-${deriveStoryStepState(story.status, "bmad-dev-story")}`}
                    >
                      {deriveStoryStepState(story.status, "bmad-dev-story")}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`step-badge step-${deriveStoryStepState(story.status, "bmad-code-review")}`}
                    >
                      {deriveStoryStepState(story.status, "bmad-code-review")}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredStories.length === 0 ? (
                <tr>
                  <td colSpan={4}>No stories found for this epic</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export const epicDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/epic/$epicId",
  component: EpicDetailPage,
});
