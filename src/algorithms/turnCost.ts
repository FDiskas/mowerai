import { DEFAULT_FITNESS_CONFIG } from "../types";
import type { Direction, FitnessConfig, PositionType as Point, State } from "../types";

type TurnWeights = Pick<FitnessConfig, "turnPenalty" | "mowedRevisitPenalty">;

const ratioInSteps = ({ turnPenalty, mowedRevisitPenalty }: TurnWeights) =>
  Math.max(0, turnPenalty) / mowedRevisitPenalty;

/** Turn cost in steps for the default training weights. */
export const DEFAULT_TURN_COST = ratioInSteps(DEFAULT_FITNESS_CONFIG);

/**
 * Turn cost for path searches and target choice, in steps.
 *
 * The training weights price a turn (`turnPenalty`) and a revisit
 * (`mowedRevisitPenalty`, one wasted step) in the same fitness points, so their
 * ratio is the price of a turn in steps. A negative turn penalty counts as 0,
 * because negative costs break the search. A revisit penalty of 0 or less gives
 * no exchange rate, so the default applies.
 */
export const turnCostInSteps = (weights: TurnWeights): number =>
  weights.mowedRevisitPenalty > 0 ? ratioInSteps(weights) : DEFAULT_TURN_COST;

export const turnCostOf = (state: Pick<State, "turnCost">): number =>
  state.turnCost ?? DEFAULT_TURN_COST;

/**
 * Fewest heading changes on an open-grid route from `pos`, facing `heading`, to
 * `target`. A reversal counts as one change, as in the path search.
 */
export const minTurnsTo = (pos: Point, heading: Direction, target: Point): number => {
  if (heading.dx === 0 && heading.dy === 0) return 0;
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const ahead = dx * heading.dx + dy * heading.dy;
  const aside = dx * heading.dy - dy * heading.dx;
  if (aside === 0) return ahead >= 0 ? 0 : 1;
  return ahead >= 0 ? 1 : 2;
};
