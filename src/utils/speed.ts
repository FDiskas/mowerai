/** Time between simulation steps for the speed slider value (higher speed, shorter delay). */
export const stepDelayMs = (speed: number): number => Math.max(10, 140 - speed);

/** Mower speed shown to the user, at 0.045 m per step. */
export const speedLabel = (speed: number): string => `${((1000 / stepDelayMs(speed)) * 0.045).toFixed(1)} m/s`;
