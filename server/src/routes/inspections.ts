import { Router } from 'express';
import { z } from 'zod';
import { getSql } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

type InspectionRow = {
  id: string;
  inspector_id: string;
  facility_id: string | null;
  type: string;
  status: string;
  data: unknown;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

function mapInspection(r: InspectionRow) {
  return {
    id: r.id,
    inspectorId: r.inspector_id,
    facilityId: r.facility_id,
    type: r.type,
    status: r.status,
    data: r.data,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    submittedAt: r.submitted_at,
  };
}

const createBody = z.object({
  facilityId: z.string().uuid().optional().nullable(),
  type: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const updateBody = z.object({
  facilityId: z.string().uuid().optional().nullable(),
  type: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const statusBody = z.object({
  status: z.enum(['draft', 'submitted', 'signed']),
});

const staffCreateBody = z.object({
  data: z.record(z.string(), z.unknown()),
});

const staffUpdateBody = z.object({
  data: z.record(z.string(), z.unknown()),
});

const responsesBulkBody = z.object({
  items: z.array(
    z.object({
      questionKey: z.string().min(1),
      value: z.unknown().optional(),
      flagged: z.boolean().optional(),
    }),
  ),
});

const flagBody = z.object({
  flagged: z.boolean(),
});

const signoffBody = z.object({
  data: z.record(z.string(), z.unknown()),
});

export const inspectionsRouter = Router();
inspectionsRouter.use(requireAuth);

async function assertFacilityOwned(
  sql: ReturnType<typeof getSql>,
  inspectorId: string,
  facilityId: string,
): Promise<boolean> {
  const rows = (await sql`
    select id from facilities
    where id = ${facilityId}::uuid and inspector_id = ${inspectorId}::uuid
    limit 1
  `) as { id: string }[];
  return Boolean(rows[0]);
}

async function getInspection(
  sql: ReturnType<typeof getSql>,
  inspectorId: string,
  id: string,
): Promise<InspectionRow | null> {
  const rows = (await sql`
    select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
    from inspections
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    limit 1
  `) as InspectionRow[];
  return rows[0] ?? null;
}

inspectionsRouter.get('/', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId.trim() : '';
  const allowed = ['draft', 'submitted', 'signed'] as const;
  const statusFilter = status && (allowed as readonly string[]).includes(status) ? status : null;

  if (statusFilter && facilityId) {
    const rows = (await sql`
      select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
      from inspections
      where inspector_id = ${inspectorId}::uuid
        and status = ${statusFilter}
        and facility_id = ${facilityId}::uuid
      order by created_at desc
      limit 200
    `) as InspectionRow[];
    res.json({ inspections: rows.map(mapInspection) });
    return;
  }
  if (statusFilter) {
    const rows = (await sql`
      select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
      from inspections
      where inspector_id = ${inspectorId}::uuid and status = ${statusFilter}
      order by created_at desc
      limit 200
    `) as InspectionRow[];
    res.json({ inspections: rows.map(mapInspection) });
    return;
  }
  if (facilityId) {
    const rows = (await sql`
      select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
      from inspections
      where inspector_id = ${inspectorId}::uuid and facility_id = ${facilityId}::uuid
      order by created_at desc
      limit 200
    `) as InspectionRow[];
    res.json({ inspections: rows.map(mapInspection) });
    return;
  }
  const rows = (await sql`
    select id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
    from inspections
    where inspector_id = ${inspectorId}::uuid
    order by created_at desc
    limit 200
  `) as InspectionRow[];
  res.json({ inspections: rows.map(mapInspection) });
});

inspectionsRouter.post('/', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const { facilityId, type, data } = parsed.data;
  if (facilityId) {
    const ok = await assertFacilityOwned(sql, inspectorId, facilityId);
    if (!ok) {
      res.status(404).json({ error: 'Facility not found' });
      return;
    }
  }
  const rows = (await sql`
    insert into inspections (inspector_id, facility_id, type, data)
    values (
      ${inspectorId}::uuid,
      ${facilityId ?? null},
      ${type ?? 'pharmacy_routine'},
      ${JSON.stringify(data ?? {})}::jsonb
    )
    returning id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
  `) as InspectionRow[];
  const row = rows[0];
  if (!row) {
    res.status(500).json({ error: 'Create failed' });
    return;
  }
  res.status(201).json(mapInspection(row));
});

inspectionsRouter.get('/:id/export/pdf', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const row = await getInspection(sql, inspectorId, id!);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(501).json({
    error: 'PDF export not implemented yet',
    inspectionId: id,
    hint: 'Wire a server-side renderer (e.g. pdfkit / puppeteer) and return application/pdf',
  });
});

inspectionsRouter.patch('/:id/submit', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const row = await getInspection(sql, inspectorId, id!);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (row.status !== 'draft') {
    res.status(400).json({ error: 'Only draft inspections can be submitted' });
    return;
  }
  const rows = (await sql`
    update inspections
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid and status = 'draft'
    returning id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
  `) as InspectionRow[];
  const next = rows[0];
  if (!next) {
    res.status(409).json({ error: 'Submit failed' });
    return;
  }
  res.json(mapInspection(next));
});

inspectionsRouter.patch('/:id/status', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const parsed = statusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const { status } = parsed.data;
  const row = await getInspection(sql, inspectorId, id!);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const submittedAt = status === 'draft' ? null : row.submitted_at ?? new Date().toISOString();
  const rows = (await sql`
    update inspections
    set
      status = ${status},
      submitted_at = ${submittedAt},
      updated_at = now()
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    returning id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
  `) as InspectionRow[];
  const next = rows[0];
  if (!next) {
    res.status(500).json({ error: 'Update failed' });
    return;
  }
  res.json(mapInspection(next));
});

inspectionsRouter.delete('/:id', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const row = await getInspection(sql, inspectorId, id!);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (row.status !== 'draft') {
    res.status(400).json({ error: 'Only draft inspections can be deleted' });
    return;
  }
  await sql`
    delete from inspections
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid and status = 'draft'
  `;
  res.status(204).end();
});

inspectionsRouter.post('/:id/staff', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const parsed = staffCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const row = await getInspection(sql, inspectorId, id!);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const rows = (await sql`
    insert into inspection_staff (inspection_id, data)
    values (${id}::uuid, ${JSON.stringify(parsed.data.data)}::jsonb)
    returning id
  `) as { id: string }[];
  const sid = rows[0]?.id;
  if (!sid) {
    res.status(500).json({ error: 'Create failed' });
    return;
  }
  res.status(201).json({ id: sid });
});

inspectionsRouter.get('/:id/staff', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const row = await getInspection(sql, inspectorId, id!);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const staff = (await sql`
    select id, data, created_at, updated_at
    from inspection_staff
    where inspection_id = ${id}::uuid
    order by created_at asc
  `) as { id: string; data: unknown; created_at: string; updated_at: string }[];
  res.json({ staff });
});

inspectionsRouter.put('/:id/staff/:sid', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const sid = req.params.sid;
  const parsed = staffUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const insp = await getInspection(sql, inspectorId, id!);
  if (!insp) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const cur = (await sql`
    select data from inspection_staff
    where id = ${sid}::uuid and inspection_id = ${id}::uuid
    limit 1
  `) as { data: Record<string, unknown> }[];
  if (!cur[0]) {
    res.status(404).json({ error: 'Staff row not found' });
    return;
  }
  const merged = { ...cur[0].data, ...parsed.data.data };
  const rows = (await sql`
    update inspection_staff
    set data = ${JSON.stringify(merged)}::jsonb, updated_at = now()
    where id = ${sid}::uuid and inspection_id = ${id}::uuid
    returning id
  `) as { id: string }[];
  if (!rows[0]) {
    res.status(404).json({ error: 'Update failed' });
    return;
  }
  res.json({ ok: true, id: rows[0].id });
});

inspectionsRouter.delete('/:id/staff/:sid', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const sid = req.params.sid;
  const insp = await getInspection(sql, inspectorId, id!);
  if (!insp) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await sql`
    delete from inspection_staff
    where id = ${sid}::uuid and inspection_id = ${id}::uuid
  `;
  res.status(204).end();
});

inspectionsRouter.post('/:id/responses', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const parsed = responsesBulkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const insp = await getInspection(sql, inspectorId, id!);
  if (!insp) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  for (const item of parsed.data.items) {
    const existing = (await sql`
      select value, flagged from inspection_responses
      where inspection_id = ${id}::uuid and question_key = ${item.questionKey}
      limit 1
    `) as { value: unknown; flagged: boolean }[];
    const cur = existing[0];
    const nextValue = item.value !== undefined ? item.value : cur?.value ?? null;
    const nextFlag = item.flagged !== undefined ? item.flagged : cur?.flagged ?? false;
    await sql`
      insert into inspection_responses (inspection_id, question_key, value, flagged, updated_at)
      values (${id}::uuid, ${item.questionKey}, ${JSON.stringify(nextValue)}::jsonb, ${nextFlag}, now())
      on conflict (inspection_id, question_key) do update
      set
        value = excluded.value,
        flagged = excluded.flagged,
        updated_at = now()
    `;
  }
  res.json({ ok: true, count: parsed.data.items.length });
});

inspectionsRouter.get('/:id/responses', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const insp = await getInspection(sql, inspectorId, id!);
  if (!insp) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const responses = (await sql`
    select id, question_key, value, flagged, updated_at
    from inspection_responses
    where inspection_id = ${id}::uuid
    order by question_key asc
  `) as {
    id: string;
    question_key: string;
    value: unknown;
    flagged: boolean;
    updated_at: string;
  }[];
  res.json({
    responses: responses.map((r) => ({
      id: r.id,
      questionKey: r.question_key,
      value: r.value,
      flagged: r.flagged,
      updatedAt: r.updated_at,
    })),
  });
});

inspectionsRouter.patch('/:id/responses/:rid/flag', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const rid = req.params.rid;
  const parsed = flagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const insp = await getInspection(sql, inspectorId, id!);
  if (!insp) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const rows = (await sql`
    update inspection_responses
    set flagged = ${parsed.data.flagged}, updated_at = now()
    where id = ${rid}::uuid and inspection_id = ${id}::uuid
    returning id, question_key, value, flagged, updated_at
  `) as {
    id: string;
    question_key: string;
    value: unknown;
    flagged: boolean;
    updated_at: string;
  }[];
  const r = rows[0];
  if (!r) {
    res.status(404).json({ error: 'Response not found' });
    return;
  }
  res.json({
    id: r.id,
    questionKey: r.question_key,
    value: r.value,
    flagged: r.flagged,
    updatedAt: r.updated_at,
  });
});

inspectionsRouter.post('/:id/signoff', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const parsed = signoffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const insp = await getInspection(sql, inspectorId, id!);
  if (!insp) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await sql`
    insert into inspection_signoff (inspection_id, data)
    values (${id}::uuid, ${JSON.stringify(parsed.data.data)}::jsonb)
    on conflict (inspection_id) do update
    set data = excluded.data, updated_at = now()
  `;
  res.json({ ok: true });
});

inspectionsRouter.put('/:id/signoff', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const parsed = signoffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const insp = await getInspection(sql, inspectorId, id!);
  if (!insp) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const cur = (await sql`
    select data from inspection_signoff where inspection_id = ${id}::uuid limit 1
  `) as { data: Record<string, unknown> }[];
  const merged = { ...(cur[0]?.data ?? {}), ...parsed.data.data };
  await sql`
    insert into inspection_signoff (inspection_id, data)
    values (${id}::uuid, ${JSON.stringify(merged)}::jsonb)
    on conflict (inspection_id) do update
    set data = excluded.data, updated_at = now()
  `;
  res.json({ ok: true });
});

inspectionsRouter.get('/:id/signoff', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const insp = await getInspection(sql, inspectorId, id!);
  if (!insp) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const rows = (await sql`
    select data, updated_at from inspection_signoff where inspection_id = ${id}::uuid limit 1
  `) as { data: unknown; updated_at: string }[];
  const row = rows[0];
  if (!row) {
    res.json({ data: null, updatedAt: null });
    return;
  }
  res.json({ data: row.data, updatedAt: row.updated_at });
});

inspectionsRouter.get('/:id', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const row = await getInspection(sql, inspectorId, id!);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(mapInspection(row));
});

inspectionsRouter.put('/:id', async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const id = req.params.id;
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const b = parsed.data;
  const cur = await getInspection(sql, inspectorId, id!);
  if (!cur) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (b.facilityId !== undefined && b.facilityId !== null) {
    const ok = await assertFacilityOwned(sql, inspectorId, b.facilityId);
    if (!ok) {
      res.status(404).json({ error: 'Facility not found' });
      return;
    }
  }
  const facilityId = b.facilityId !== undefined ? b.facilityId : cur.facility_id;
  const type = b.type ?? cur.type;
  const data =
    b.data !== undefined
      ? { ...(typeof cur.data === 'object' && cur.data !== null ? (cur.data as object) : {}), ...b.data }
      : cur.data;
  const rows = (await sql`
    update inspections
    set
      facility_id = ${facilityId},
      type = ${type},
      data = ${JSON.stringify(data)}::jsonb,
      updated_at = now()
    where id = ${id}::uuid and inspector_id = ${inspectorId}::uuid
    returning id, inspector_id, facility_id, type, status, data, created_at, updated_at, submitted_at
  `) as InspectionRow[];
  const next = rows[0];
  if (!next) {
    res.status(500).json({ error: 'Update failed' });
    return;
  }
  res.json(mapInspection(next));
});
