import { setRequestLocale, getTranslations } from 'next-intl/server';
import { INTERNAL_NAV } from '@/components/navigation/nav-config';
import { ComingSoon } from '@/components/shared/coming-soon';

export default async function AdminSectionPage({
  params,
}: {
  params: { locale: string; rest: string[] };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('Nav');
  const tcs = await getTranslations('ComingSoon');

  const href = '/admin/' + (params.rest ?? []).join('/');
  const item = INTERNAL_NAV.flatMap((g) => g.items).find((i) => i.href === href);
  const title = item ? t(item.labelKey) : (params.rest?.[0] ?? '').replace(/-/g, ' ');

  return <ComingSoon title={title} body={tcs('body')} phaseLabel={tcs('phaseLabel')} />;
}
