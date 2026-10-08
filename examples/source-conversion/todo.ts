export function toggle(done: boolean): boolean {
  return !done;
}

export const remaining = (done: boolean[]): number =>
  done.filter(value => !value).length;
