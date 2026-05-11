export const pharmacyChecklist = {
  type: 'pharmacy',
  version: 1,
  title: 'Pharmacy inspection checklist',
  sections: [
    {
      id: 'part_iii',
      title: 'Part III — Checklist',
      questions: [
        {
          key: 'pharmacy.sample',
          prompt: 'Sample question (replace with Pharmacy Council items)',
          input: 'boolean',
          required: false,
        },
      ],
    },
  ],
} as const;

export const otcChecklist = {
  type: 'otc',
  version: 1,
  title: 'OTC inspection checklist',
  sections: [
    {
      id: 'part_iii',
      title: 'Part III — Checklist',
      questions: [
        {
          key: 'otc.sample',
          prompt: 'Sample question (replace with OTC programme items)',
          input: 'boolean',
          required: false,
        },
      ],
    },
  ],
} as const;
