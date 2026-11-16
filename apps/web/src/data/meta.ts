/** Key/value rows of the `meta` table in the local database. */
export type MetaRow = { key: string; value: number };

/** Local midnight of the day the stored demo data is aligned to; see `redateToToday`. */
export const DATA_DAY_KEY = "dataDay";
