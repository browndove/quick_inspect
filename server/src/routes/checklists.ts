import { Router } from 'express';
import { otcChecklist, pharmacyChecklist } from '../data/checklists.js';

const templates: Record<string, unknown> = {
  pharmacy: pharmacyChecklist,
  otc: otcChecklist,
};

export const checklistsRouter = Router();

checklistsRouter.get('/:type', (req, res) => {
  const type = req.params.type?.toLowerCase() ?? '';
  const body = templates[type];
  if (!body) {
    res.status(404).json({ error: 'Unknown checklist type', allowed: ['pharmacy', 'otc'] });
    return;
  }
  res.json(body);
});
