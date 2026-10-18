import type { Direction, PositionType as Point, State } from "../types";
import { SCORE_WEIGHTS } from "../simulation/score";

/** Turn cost in steps for path searches and target choice: the benchmark prices a turn at this many steps. */
export const DEFAULT_TURN_COST = SCORE_WEIGHTS.turn / SCORE_WEIGHTS.step;

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
