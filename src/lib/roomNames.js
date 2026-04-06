// Shared room names cache - ανανεώνεται κάθε φορά που αλλάζει κάποιο όνομα
import { db } from './db';

let cache = {};
let listeners = [];

export const roomNamesCache = {
  get: () => cache,
  load: async () => {
    const rooms = await db.Room.list();
    cache = {};
    rooms.forEach(r => { if (r.room_name) cache[r.room_number] = r.room_name; });
    listeners.forEach(fn => fn(cache));
    return cache;
  },
  subscribe: (fn) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  },
  getName: (num) => cache[num] || `Δωμάτιο ${num}`,
};
