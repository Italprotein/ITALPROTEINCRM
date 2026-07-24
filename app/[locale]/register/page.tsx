import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { RegisterForm } from '@/components/register/register-form';

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tc = await getTranslations('Common');

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
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
      <main className="flex-1">
        <RegisterForm />
      </main>
    </div>
  );
}
