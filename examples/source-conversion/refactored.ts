export function toggle(done: boolean): boolean {
  return done ? false : true;
}

export const remaining = (done: boolean[]): number =>
  done.filter(value => value ? false : true).length;
