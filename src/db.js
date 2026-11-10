// Stand-in for the `save` the interview provides. Synchronous: object in, object out.
let nextId = 1;
export function save(user) {
  return { id: nextId++, ...user };
}
