const MIN_SESSIONS_FOR_CONFIDENCE = 3;
const PRIMARY_SKILL_MODEL_SEPARATOR = "|||";
const LEGACY_SKILL_MODEL_SEPARATOR = "::";

type SkillModelQuality = {
	sessions: number;
	oneShotRate: number;
};

type QualityPayloadLike = {
	quality?: {
		bySkillModel: Record<string, SkillModelQuality>;
	};
	sessions?: unknown[];
};

function quoteYamlString(value: string): string {
	const escaped = value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
	return `"${escaped}"`;
}

function quoteYamlKey(value: string): string {
	return quoteYamlString(value);
}

export type QualityConfigResult = {
	yaml: string;
	metadata: {
		generatedAt: string;
		totalSessions: number;
		dataCoverage: number;
	};
};

function parseSkillModelKey(key: string): { skill: string; model: string } | null {
	const separators = [PRIMARY_SKILL_MODEL_SEPARATOR, LEGACY_SKILL_MODEL_SEPARATOR];
	for (const separator of separators) {
		const sepIdx = key.indexOf(separator);
		if (sepIdx === -1) {
			continue;
		}
		return {
			skill: key.slice(0, sepIdx),
			model: key.slice(sepIdx + separator.length),
		};
	}
	return null;
}

function buildSkillsFromBySkillModel(
	bySkillModel: Record<string, SkillModelQuality>,
): {
	skillsYaml: string;
	skillsWithConfidence: number;
	totalSkills: number;
} {
	// Group entries by skill
	const skillMap = new Map<
		string,
		Array<{ model: string; metric: SkillModelQuality }>
	>();
	for (const [key, metric] of Object.entries(bySkillModel)) {
		const parsed = parseSkillModelKey(key);
		if (!parsed) continue;
		const { skill, model } = parsed;
		const existing = skillMap.get(skill);
		if (existing) {
			existing.push({ model, metric });
		} else {
			skillMap.set(skill, [{ model, metric }]);
		}
	}

	const skillLines: string[] = [];
	let skillsWithConfidence = 0;
	const totalSkills = skillMap.size;

	const sortedSkills = [...skillMap.entries()].sort(([left], [right]) =>
		left.localeCompare(right),
	);
	for (const [skill, entries] of sortedSkills) {
		// Filter to models with enough sessions and sort by oneShotRate desc
		const qualified = entries
			.filter((e) => e.metric.sessions >= MIN_SESSIONS_FOR_CONFIDENCE)
			.sort((a, b) => b.metric.oneShotRate - a.metric.oneShotRate);

		if (qualified.length === 0) {
			// Insufficient data — find best available for session count
			const best = entries.sort(
				(a, b) => b.metric.sessions - a.metric.sessions,
			)[0];
			const sessionCount = best?.metric.sessions ?? 0;
			skillLines.push(`  ${quoteYamlKey(skill)}:`);
			skillLines.push(`    model: "default"`);
			skillLines.push(`    confidence: "insufficient-data"`);
			skillLines.push(`    sessions: ${sessionCount}`);
		} else {
			skillsWithConfidence += 1;
			const recommended = qualified[0];
			const fallback = qualified[1] ?? null;
			skillLines.push(`  ${quoteYamlKey(skill)}:`);
			skillLines.push(`    model: ${quoteYamlString(recommended.model)}`);
			if (fallback) {
				skillLines.push(`    fallback: ${quoteYamlString(fallback.model)}`);
			}
			skillLines.push(
				`    one_shot_rate: ${Number.parseFloat(recommended.metric.oneShotRate.toFixed(2))}`,
			);
			skillLines.push(`    sessions: ${recommended.metric.sessions}`);
		}
	}

	return {
		skillsYaml: skillLines.join("\n"),
		skillsWithConfidence,
		totalSkills,
	};
}

export function generateQualityConfigYaml(
	payload: QualityPayloadLike,
): QualityConfigResult {
	const generatedAt = new Date().toISOString();
	const totalSessions = payload.sessions?.length ?? 0;

	if (
		!payload.quality?.bySkillModel ||
		Object.keys(payload.quality.bySkillModel).length === 0
	) {
		const yaml = [
			`metadata:`,
			`  generatedAt: "${generatedAt}"`,
			`  totalSessions: ${totalSessions}`,
			`  dataCoverage: 0`,
			``,
			`skills: {}`,
		].join("\n");

		return {
			yaml,
			metadata: { generatedAt, totalSessions, dataCoverage: 0 },
		};
	}

	const { skillsYaml, skillsWithConfidence, totalSkills } =
		buildSkillsFromBySkillModel(payload.quality.bySkillModel);

	const dataCoverage =
		totalSkills > 0
			? Number.parseFloat((skillsWithConfidence / totalSkills).toFixed(2))
			: 0;

	const yaml = [
		`metadata:`,
		`  generatedAt: "${generatedAt}"`,
		`  totalSessions: ${totalSessions}`,
		`  dataCoverage: ${dataCoverage}`,
		``,
		`skills:`,
		skillsYaml,
	].join("\n");

	return {
		yaml,
		metadata: { generatedAt, totalSessions, dataCoverage },
	};
}
