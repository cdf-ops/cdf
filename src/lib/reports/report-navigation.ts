export type ReportNavigation = {
  basePath: string;
  overviewPath: string;
};

export function buildReportHref(
  navigation: ReportNavigation,
  values: Record<string, string | number | undefined>
) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${navigation.basePath}?${query}` : navigation.basePath;
}
