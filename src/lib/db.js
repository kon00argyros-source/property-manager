import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oebryxfgyfvyoiborfrx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lYnJ5eGZneWZ2eW9pYm9yZnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTIxNTcsImV4cCI6MjA5MDQyODE1N30.5nok05LB0WV_iOO-SwQ46_avg8xscHQwyOO1EfeFoxA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLE_MAP = {
  Room: 'rooms',
  PowerRecord: 'power_records',
  WaterRecord: 'water_records',
  RentPayment: 'rent_payments',
  RoomNote: 'room_notes',
  AppSettings: 'app_settings',
};

const createEntity = (entityName) => {
  const table = TABLE_MAP[entityName];
  return {
    list: async (sortField) => {
      let query = supabase.from(table).select('*');
      if (sortField) {
        const field = sortField.startsWith('-') ? sortField.slice(1) : sortField;
        query = query.order(field, { ascending: !sortField.startsWith('-') });
      }
      const { data, error } = await query;
      if (error) { console.error(error); return []; }
      return data || [];
    },
    filter: async (filters, sortField, limit) => {
      let query = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      if (sortField) {
        const field = sortField.startsWith('-') ? sortField.slice(1) : sortField;
        query = query.order(field, { ascending: !sortField.startsWith('-') });
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) { console.error(error); return []; }
      return data || [];
    },
    create: async (obj) => {
      const { data, error } = await supabase.from(table).insert([obj]).select().single();
      if (error) { console.error(error); return null; }
      return data;
    },
    update: async (id, updates) => {
      const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
      if (error) { console.error(error); return null; }
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) console.error(error);
    },
  };
};

export const db = {
  Room: createEntity('Room'),
  PowerRecord: createEntity('PowerRecord'),
  WaterRecord: createEntity('WaterRecord'),
  RentPayment: createEntity('RentPayment'),
  RoomNote: createEntity('RoomNote'),
  AppSettings: createEntity('AppSettings'),
};
