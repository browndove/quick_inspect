import { Hono } from 'hono';
import { otcChecklist, pharmacyChecklist } from '../data/checklists.js';

const templates: Record<string, unknown> = {
  pharmacy: pharmacyChecklist,
  otc: otcChecklist,
};

export const checklists = new Hono();

checklists.get('/:type', (c) => {
  const type = c.req.param('type').toLowerCase();
  const body = templates[type];
  if (!body) {
    return c.json({ error: 'Unknown checklist type', allowed: ['pharmacy', 'otc'] }, 404);
  }
  return c.json(body);
});
