import type { CELL_TYPES } from "../constants";
import type { Direction, Grid, PositionType as Point, State } from "../types";

type Orientation = State["orientation"];

const reverse = (d: Direction): Direction => ({ dx: -d.dx, dy: -d.dy });
const isStill = (d: Direction) => d.dx === 0 && d.dy === 0;
const isParallel = (a: Direction, b: Direction) => a.dx * b.dy === a.dy * b.dx;

/** Lane heading for the selected orientation; without one, lanes follow the current heading. */
const laneAxis = (orientation: Orientation, prevDir: Direction): Direction => {
  if (orientation === "horizontal") return { dx: 1, dy: 0 };
  if (orientation === "vertical") return { dx: 0, dy: 1 };
  return isStill(prevDir) || prevDir.dx !== 0 ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
};

/**
 * Headings for a boustrophedon lane sweep, grouped from most to least preferred.
 *
 * On a lane: keep going, else shift one tile to a neighbouring lane, else reverse.
 * Off a lane (just shifted, or starting): turn into the lane direction that runs
 * back along the lane just mowed, else the other lane direction, else keep shifting.
 */
export const laneSweepHeadings = (
  pos: Point,
  prevDir: Direction,
  orientation: Orientation,
  grid: Grid,
  cellTypes: typeof CELL_TYPES,
): Direction[][] => {
  const lane = laneAxis(orientation, prevDir);
  const shift = { dx: lane.dy, dy: lane.dx };

  if (isStill(prevDir)) return [[lane, reverse(lane)], [shift, reverse(shift)]];
  if (isParallel(prevDir, lane)) return [[prevDir], [shift, reverse(shift)], [reverse(prevDir)]];

  const cameFrom = { x: pos.x - prevDir.dx, y: pos.y - prevDir.dy };
  const runsAlongMowedLane = (d: Direction) =>
    grid[cameFrom.y + d.dy]?.[cameFrom.x + d.dx]?.type === cellTypes.MOWED;
  const [first, second] = runsAlongMowedLane(reverse(lane)) ? [reverse(lane), lane] : [lane, reverse(lane)];
  return [[first], [second], [prevDir], [reverse(prevDir)]];
};

/**
 * One step of a lane sweep: the best enterable neighbour in the first heading
 * group that has one. `rank` breaks ties inside a group (higher wins, first on equal).
 */
export const nextLaneSweepStep = (
  pos: Point,
  prevDir: Direction,
  orientation: Orientation,
  grid: Grid,
  cellTypes: typeof CELL_TYPES,
  canEnter: (p: Point) => boolean,
  rank: (p: Point) => number = () => 0,
): Point | null => {
  for (const group of laneSweepHeadings(pos, prevDir, orientation, grid, cellTypes)) {
    const options = group
      .map((d) => ({ x: pos.x + d.dx, y: pos.y + d.dy }))
      .filter(canEnter);
    if (options.length === 0) continue;
    return options.reduce((best, p) => (rank(p) > rank(best) ? p : best));
  }
  return null;
};
