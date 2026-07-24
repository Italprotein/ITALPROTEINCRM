'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { CheckCircle2, Building2, User, Sparkles, ShieldCheck } from 'lucide-react';

import { registrationService } from '@/lib/mock-services';
import { COMPANY_TYPES } from '@/lib/types';
import type { Registration, CompanyType, Locale } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { uid } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

/* Self-contained bilingual copy — this public page collects data rather than
   displaying it, so the labels live with the form instead of the shared i18n
   bundle. */
const COPY = {
  en: {
    heading: 'Register your business',
    sub: 'Tell us about your company and the person we should talk to. Our team reviews every request and gets back to you.',
    secCompany: 'Company', secContact: 'Your details', secInterest: 'What you’re looking for', secConsent: 'Consent',
    legalName: 'Company legal name', tradingName: 'Trading name', companyType: 'Company type', website: 'Website',
    country: 'Country', city: 'City',
    firstName: 'First name', lastName: 'Last name', jobTitle: 'Role', email: 'Work email', phone: 'Phone',
    reason: 'Why are you reaching out?', samples: 'I’d like to receive product samples', message: 'Anything else?',
    privacy: 'I accept the privacy policy.', terms: 'I accept the terms of engagement.',
    marketing: 'Keep me updated about Proamina® (optional).',
    submit: 'Submit registration', submitting: 'Submitting…',
    required: 'Please complete the required fields (marked *) and accept the privacy and terms.',
    okTitle: 'Thank you — we’ve received your registration',
    okBody: 'Your reference is {ref}. Our team will review it and contact {email} shortly.',
    home: 'Back to home', another: 'Submit another',
    ph_email: 'name@company.com',
  },
  it: {
    heading: 'Registra la tua azienda',
    sub: 'Raccontaci della tua azienda e della persona con cui parlare. Il nostro team esamina ogni richiesta e ti ricontatta.',
    secCompany: 'Azienda', secContact: 'I tuoi dati', secInterest: 'Cosa cerchi', secConsent: 'Consenso',
    legalName: 'Ragione sociale', tradingName: 'Nome commerciale', companyType: 'Tipo di azienda', website: 'Sito web',
    country: 'Paese', city: 'Città',
    firstName: 'Nome', lastName: 'Cognome', jobTitle: 'Ruolo', email: 'Email aziendale', phone: 'Telefono',
    reason: 'Perché ci contatti?', samples: 'Vorrei ricevere dei campioni', message: 'Altro?',
    privacy: 'Accetto l’informativa sulla privacy.', terms: 'Accetto i termini di collaborazione.',
    marketing: 'Tienimi aggiornato su Proamina® (facoltativo).',
    submit: 'Invia registrazione', submitting: 'Invio in corso…',
    required: 'Completa i campi obbligatori (con *) e accetta privacy e termini.',
    okTitle: 'Grazie — abbiamo ricevuto la tua registrazione',
    okBody: 'Il tuo riferimento è {ref}. Il nostro team la esaminerà e contatterà {email} a breve.',
    home: 'Torna alla home', another: 'Invia un’altra',
    ph_email: 'nome@azienda.com',
  },
} as const;

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-brand-gold" /> {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
      {children}
    </div>
  );
}

export function RegisterForm() {
  const locale = useLocale() as Locale;
  const t = COPY[locale] ?? COPY.en;

  const [legalName, setLegalName] = React.useState('');
  const [tradingName, setTradingName] = React.useState('');
  const [companyType, setCompanyType] = React.useState<CompanyType>('fb_manufacturer');
  const [website, setWebsite] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [city, setCity] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [samples, setSamples] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [privacy, setPrivacy] = React.useState(false);
  const [terms, setTerms] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [done, setDone] = React.useState<{ ref: string; email: string } | null>(null);

  const emailOk = /.+@.+\..+/.test(email.trim());
  const valid =
    legalName.trim() && country.trim() && firstName.trim() && lastName.trim() && emailOk && privacy && terms;

  function reset() {
    setLegalName(''); setTradingName(''); setCompanyType('fb_manufacturer'); setWebsite('');
    setCountry(''); setCity(''); setFirstName(''); setLastName(''); setJobTitle(''); setEmail('');
    setPhone(''); setReason(''); setSamples(false); setMessage('');
    setPrivacy(false); setTerms(false); setMarketing(false);
  }

  async function submit() {
    setError(false);
    if (!valid || submitting) { setError(true); return; }
    setSubmitting(true);
    const reference = `REG-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const registration: Registration = {
      id: uid('reg'),
      reference,
      status: 'submitted',
      legalName: legalName.trim(),
      tradingName: tradingName.trim() || undefined,
      companyType,
      website: website.trim() || undefined,
      country: country.trim(),
      countryCode: country.trim().slice(0, 2).toUpperCase(),
      city: city.trim(),
      preferredLanguage: locale,
      preferredCurrency: 'EUR',
      contactFirstName: firstName.trim(),
      contactLastName: lastName.trim(),
      contactJobTitle: jobTitle.trim() || undefined,
      contactEmail: email.trim(),
      contactPhone: phone.trim() || undefined,
      reason: reason.trim() || undefined,
      samplesRequested: samples,
      additionalMessage: message.trim() || undefined,
      privacyAccepted: privacy,
      termsAccepted: terms,
      marketingOptIn: marketing,
      createdAt: new Date().toISOString(),
    };
    try {
      await registrationService.create(registration);
      setDone({ ref: reference, email: email.trim() });
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-foreground">{t.okTitle}</h1>
        <p className="mt-3 text-muted-foreground">
          {t.okBody.replace('{ref}', done.ref).replace('{email}', done.email)}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="gold"><Link href="/">{t.home}</Link></Button>
          <Button variant="outline" onClick={() => { reset(); setDone(null); }}>{t.another}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">{t.heading}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.sub}</p>
      </div>

      <div className="space-y-4">
        <Section icon={Building2} title={t.secCompany}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="legalName" label={t.legalName} required>
                <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
              </Field>
            </div>
            <Field id="tradingName" label={t.tradingName}>
              <Input id="tradingName" value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
            </Field>
            <Field id="companyType" label={t.companyType} required>
              <Select value={companyType} onValueChange={(v) => setCompanyType(v as CompanyType)}>
                <SelectTrigger id="companyType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>{getLabel('companyType', ct)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="country" label={t.country} required>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>
            <Field id="city" label={t.city}>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="website" label={t.website}>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={User} title={t.secContact}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="firstName" label={t.firstName} required>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field id="lastName" label={t.lastName} required>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
            <Field id="email" label={t.email} required>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.ph_email} />
            </Field>
            <Field id="phone" label={t.phone}>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="jobTitle" label={t.jobTitle}>
                <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Sparkles} title={t.secInterest}>
          <Field id="reason" label={t.reason}>
            <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox checked={samples} onCheckedChange={(v) => setSamples(v === true)} />
            {t.samples}
          </label>
          <Field id="message" label={t.message}>
            <Textarea id="message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
        </Section>

        <Section icon={ShieldCheck} title={t.secConsent}>
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} className="mt-0.5" />
            <span>{t.privacy} *</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
            <span>{t.terms} *</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} className="mt-0.5" />
            <span>{t.marketing}</span>
          </label>
        </Section>

        {error ? <p className="text-sm text-danger">{t.required}</p> : null}

        <Button variant="gold" size="lg" className="w-full" onClick={submit} disabled={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </div>
    </div>
  );
}
