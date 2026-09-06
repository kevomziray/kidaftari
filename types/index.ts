export type AsyncPageProps<
  TParams = Record<string, string>,
  TSearchParams = Record<string, string | undefined>,
> = {
  params: Promise<TParams>;
  searchParams: Promise<TSearchParams>;
};
