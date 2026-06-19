import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PORTAL_NAV } from '@/components/navigation/nav-config';
import { ComingSoon } from '@/components/shared/coming-soon';

export default async function PortalSectionPage({
  params,
}: {
  params: { locale: string; rest: string[] };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('PortalNav');
  const tcs = await getTranslations('ComingSoon');

  const href = '/portal/' + (params.rest ?? []).join('/');
  const item = PORTAL_NAV.find((i) => i.href === href);
  const title = item ? t(item.labelKey) : (params.rest?.[0] ?? '').replace(/-/g, ' ');

  return <ComingSoon title={title} body={tcs('body')} phaseLabel={tcs('phaseLabel')} />;
}
