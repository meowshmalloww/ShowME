import type { LearningCheck, LearningCheckStage, LearningOutcome, LessonPlan } from "./types";

export function lessonCheckForStage(
  plan: Pick<LessonPlan, "learningCheck" | "transferCheck">,
  stage: LearningCheckStage,
): LearningCheck | undefined {
  return stage === "transfer" ? plan.transferCheck : plan.learningCheck;
}

export function nextLearningStage(
  plan: Pick<LessonPlan, "transferCheck">,
  stage: LearningCheckStage,
  result: LearningOutcome["result"],
): LearningCheckStage | "complete" {
  if (result === "retry") return stage;
  if (stage === "try" && plan.transferCheck) return "transfer";
  return "complete";
}
