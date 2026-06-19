import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { ComingSoon } from '@/components/shared/coming-soon';

export default async function RegisterPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const tl = await getTranslations('Landing');
  const tcs = await getTranslations('ComingSoon');
  const tc = await getTranslations('Common');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Logo tone="dark" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher tone="dark" />
            <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> {tc('backToHome')}
            </Link>
          </div>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center bg-muted/20">
        <ComingSoon title={tl('ctaRegister')} body={tcs('body')} phaseLabel={tcs('phaseLabel')} />
      </div>
    </div>
  );
}
