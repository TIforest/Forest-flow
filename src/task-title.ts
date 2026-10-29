export const taskTitleKey = (title: string) =>
  title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
