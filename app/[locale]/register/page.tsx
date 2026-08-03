import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Module } from '@/components/public/module';
import { PublicShell } from '@/components/public/public-shell';
import { RegisterForm } from '@/components/register/register-form';

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Register');

  return (
    <PublicShell>
      <Module designation={t('eyebrow')}>
        <RegisterForm />
      </Module>
    </PublicShell>
  );
}
