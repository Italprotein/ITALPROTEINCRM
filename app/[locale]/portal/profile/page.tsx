'use client';

import * as React from 'react';
import {
  Building2,
  Users,
  FileText,
  FileSignature,
  Globe,
  MapPin,
  Truck,
  Settings2,
  Mail,
  Plus,
  Loader2,
  Save,
  RotateCcw,
  ShieldCheck,
  Lock,
  Info,
} from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import {
  companyService,
  contactService,
  documentService,
  ndaService,
} from '@/lib/mock-services';
import { can } from '@/lib/permissions';
import {
  APPLICATION_CATEGORIES,
  COMPANY_TYPES,
  type Address,
  type ApplicationCategory,
  type Company,
  type CompanyType,
  type Contact,
  type Currency,
  type DecisionRole,
  type Locale,
} from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { uid } from '@/lib/utils';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FadeIn } from '@/components/shared/motion';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ConfirmDialog,
} from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';

/* ─────────────────────────── Local form types ─────────────────────────── */

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italian' },
];

const CURRENCIES: Currency[] = ['EUR', 'USD', 'GBP', 'CHF'];

const COMMUNICATION_METHODS = ['email', 'phone', 'video_call', 'whatsapp', 'portal'] as const;
const COMMUNICATION_LABELS: Record<(typeof COMMUNICATION_METHODS)[number], string> = {
  email: 'Email',
  phone: 'Phone',
  video_call: 'Video call',
  whatsapp: 'WhatsApp',
  portal: 'Portal messages',
};

/** Editable shape of the form — mirrors the subset of Company we let clients touch. */
interface ProfileForm {
  legalName: string;
  tradingName: string;
  type: CompanyType;
  mainActivity: string;
  website: string;
  vatNumber: string;
  registrationNumber: string;

  hqLine1: string;
  hqCity: string;
  hqPostalCode: string;
  hqCountry: string;

  billingSameAsHq: boolean;
  billingLine1: string;
  billingCity: string;
  billingPostalCode: string;
  billingCountry: string;

  shippingLine1: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;

  preferredLanguage: Locale;
  preferredCurrency: Currency;
  applicationInterests: ApplicationCategory[];
  preferredCommunication: string;

  preferredCourier: string;
  deliveryInstructions: string;
  logisticsRequirements: string;
}

/* Fields that are "sensitive": persisted only after Italprotein review. */
const SENSITIVE_FIELDS: (keyof ProfileForm)[] = ['legalName', 'vatNumber'];

function addressesEqual(a?: Address, b?: Address): boolean {
  if (!a || !b) return false;
  return (
    a.line1 === b.line1 &&
    a.city === b.city &&
    (a.postalCode ?? '') === (b.postalCode ?? '') &&
    a.country === b.country
  );
}

function buildForm(c: Company): ProfileForm {
  const hq = c.headquarters;
  const billing = c.billingAddress;
  const shipping = c.shippingAddresses?.[0];
  const interests = (c.productCategories ?? []).filter((x): x is ApplicationCategory =>
    APPLICATION_CATEGORIES.includes(x),
  );
  return {
    legalName: c.legalName,
    tradingName: c.tradingName ?? '',
    type: c.type,
    mainActivity: c.mainActivity ?? '',
    website: c.website ?? '',
    vatNumber: c.vatNumber ?? '',
    registrationNumber: c.registrationNumber ?? '',

    hqLine1: hq.line1,
    hqCity: hq.city,
    hqPostalCode: hq.postalCode ?? '',
    hqCountry: hq.country,

    billingSameAsHq: !billing || addressesEqual(billing, hq),
    billingLine1: billing?.line1 ?? '',
    billingCity: billing?.city ?? '',
    billingPostalCode: billing?.postalCode ?? '',
    billingCountry: billing?.country ?? '',

    shippingLine1: shipping?.line1 ?? '',
    shippingCity: shipping?.city ?? '',
    shippingPostalCode: shipping?.postalCode ?? '',
    shippingCountry: shipping?.country ?? '',

    preferredLanguage: c.preferredLanguage,
    preferredCurrency: c.preferredCurrency,
    applicationInterests: interests,
    preferredCommunication:
      c.tags?.find((t) => (COMMUNICATION_METHODS as readonly string[]).includes(t)) ?? 'email',

    preferredCourier: c.preferredCourier ?? '',
    deliveryInstructions: c.deliveryInstructions ?? '',
    logisticsRequirements: c.logisticsRequirements ?? '',
  };
}

const WEBSITE_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;

function validate(form: ProfileForm): Partial<Record<keyof ProfileForm, string>> {
  const errors: Partial<Record<keyof ProfileForm, string>> = {};
  if (!form.legalName.trim()) errors.legalName = 'Legal name is required.';
  if (!form.hqCountry.trim()) errors.hqCountry = 'Country is required.';
  if (form.website.trim() && !WEBSITE_RE.test(form.website.trim()))
    errors.website = 'Enter a valid website (e.g. https://example.com).';
  return errors;
}

/* Profile completion: weighted on the fields a client can fill in. */
function completion(form: ProfileForm): number {
  const checks: boolean[] = [
    !!form.legalName.trim(),
    !!form.tradingName.trim(),
    !!form.mainActivity.trim(),
    !!form.website.trim(),
    !!form.vatNumber.trim(),
    !!form.hqLine1.trim() && !!form.hqCity.trim() && !!form.hqCountry.trim(),
    form.billingSameAsHq || (!!form.billingLine1.trim() && !!form.billingCity.trim()),
    !!form.shippingLine1.trim() && !!form.shippingCity.trim(),
    form.applicationInterests.length > 0,
    !!form.preferredCourier.trim(),
    !!form.deliveryInstructions.trim(),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export default function PortalProfilePage() {
  const { session, ready } = useSession();
  const role = session?.role;
  const companyId = session?.companyId;

  const canEdit = !!role && can(role, 'portal.edit_company');
  const canSensitive = !!role && can(role, 'portal.submit_sensitive_edit');

  const [company, setCompany] = React.useState<Company | null>(null);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [docCount, setDocCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [form, setForm] = React.useState<ProfileForm | null>(null);
  const [baseline, setBaseline] = React.useState<ProfileForm | null>(null);
  const [errors, setErrors] = React.useState<Partial<Record<keyof ProfileForm, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);

  React.useEffect(() => {
    if (!ready) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const c = await companyService.get(companyId);
      if (!active) return;
      if (!c) {
        setLoading(false);
        return;
      }
      const ndaSigned = c.ndaStatus === 'fully_signed';
      const [cts, ndas, docs] = await Promise.all([
        contactService.byCompany(companyId),
        ndaService.byCompany(companyId),
        documentService.forPortal(companyId, ndaSigned),
      ]);
      if (!active) return;
      void ndas;
      const f = buildForm(c);
      setCompany(c);
      setContacts(cts);
      setDocCount(docs.length);
      setForm(f);
      setBaseline(f);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [ready, companyId]);

  const dirty = React.useMemo(() => {
    if (!form || !baseline) return false;
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, baseline]);

  // Warn the user before navigating away with unsaved edits.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleInterest(cat: ApplicationCategory, checked: boolean) {
    setForm((prev) => {
      if (!prev) return prev;
      const next = checked
        ? [...prev.applicationInterests, cat]
        : prev.applicationInterests.filter((c) => c !== cat);
      return { ...prev, applicationInterests: next };
    });
  }

  const sensitiveDirty = React.useMemo(() => {
    if (!form || !baseline) return false;
    return SENSITIVE_FIELDS.some((k) => form[k] !== baseline[k]);
  }, [form, baseline]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !company) return;

    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      toast({
        title: 'Check the highlighted fields',
        description: 'Some required details are missing or invalid.',
        variant: 'warning',
      });
      return;
    }

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    // Build the patch — sensitive fields are NOT applied directly.
    const hq: Address = {
      ...company.headquarters,
      line1: form.hqLine1.trim(),
      city: form.hqCity.trim(),
      postalCode: form.hqPostalCode.trim() || undefined,
      country: form.hqCountry.trim(),
    };
    const billing: Address | undefined = form.billingSameAsHq
      ? undefined
      : {
          label: 'Billing',
          line1: form.billingLine1.trim(),
          city: form.billingCity.trim(),
          postalCode: form.billingPostalCode.trim() || undefined,
          country: form.billingCountry.trim() || form.hqCountry.trim(),
          countryCode: company.billingAddress?.countryCode ?? company.countryCode,
        };
    const shipping: Address[] | undefined = form.shippingLine1.trim()
      ? [
          {
            label: 'Shipping',
            line1: form.shippingLine1.trim(),
            city: form.shippingCity.trim(),
            postalCode: form.shippingPostalCode.trim() || undefined,
            country: form.shippingCountry.trim() || form.hqCountry.trim(),
            countryCode: company.shippingAddresses?.[0]?.countryCode ?? company.countryCode,
          },
        ]
      : company.shippingAddresses;

    // Preserve any non-communication tags, then store the chosen method as a tag.
    const otherTags = (company.tags ?? []).filter(
      (t) => !(COMMUNICATION_METHODS as readonly string[]).includes(t),
    );

    const patch: Partial<Company> = {
      tradingName: form.tradingName.trim() || undefined,
      type: form.type,
      mainActivity: form.mainActivity.trim() || undefined,
      website: form.website.trim() || undefined,
      registrationNumber: form.registrationNumber.trim() || undefined,
      headquarters: hq,
      city: hq.city,
      country: hq.country,
      billingAddress: billing,
      shippingAddresses: shipping,
      preferredLanguage: form.preferredLanguage,
      preferredCurrency: form.preferredCurrency,
      productCategories: form.applicationInterests,
      preferredCourier: form.preferredCourier.trim() || undefined,
      deliveryInstructions: form.deliveryInstructions.trim() || undefined,
      logisticsRequirements: form.logisticsRequirements.trim() || undefined,
      tags: [...otherTags, form.preferredCommunication],
    };

    const submittedForReview = sensitiveDirty && canSensitive;
    // Apply sensitive edits directly only if the role cannot submit-for-review
    // (otherwise they stay pending and the displayed value reverts to current).
    if (!canSensitive) {
      if (form.legalName.trim()) patch.legalName = form.legalName.trim();
      patch.vatNumber = form.vatNumber.trim() || undefined;
    }

    const updated = await companyService.update(company.id, patch);

    setSubmitting(false);

    if (updated) {
      // The baseline now reflects what is actually stored. Sensitive fields, if
      // submitted for review, revert to the stored (unchanged) value.
      const f = buildForm(updated);
      setCompany(updated);
      setForm(f);
      setBaseline(f);
    }

    if (submittedForReview) {
      toast({
        title: 'Changes submitted for review',
        description:
          'Updates to legal name or VAT number are reviewed by your Italprotein team before they take effect.',
        variant: 'info',
      });
    } else {
      toast({ title: 'Profile updated', variant: 'success' });
    }
  }

  function handleResetConfirmed() {
    setForm(baseline);
    setErrors({});
    setResetOpen(false);
    toast({ title: 'Changes discarded', variant: 'default' });
  }

  /* ── Loading / empty states ── */

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!companyId || !company || !form) {
    return (
      <div className="space-y-6">
        <PageHeader title="Company profile" />
        <EmptyState
          icon={Building2}
          title="No company linked to your account"
          description="We couldn't find a company for your portal account. Please contact your Italprotein representative."
        />
      </div>
    );
  }

  const pct = completion(form);
  const disabled = !canEdit;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company profile"
        subtitle={company.tradingName ?? company.legalName}
        actions={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(true)}
                disabled={!dirty || submitting}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button type="submit" form="profile-form" variant="gold" disabled={!dirty || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {submitting ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          ) : (
            <Badge variant="muted" className="gap-1.5">
              <Lock className="h-3 w-3" />
              View only
            </Badge>
          )
        }
      />

      {/* Profile completion + stats */}
      <FadeIn>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Profile completion</p>
                <p className="text-xs text-muted-foreground">
                  A complete profile helps us prepare samples and shipments faster.
                </p>
              </div>
              <span className="text-2xl font-bold tabular text-brand-goldDark">{pct}%</span>
            </div>
            <Progress value={pct} className="mt-3" />
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Contacts" value={contacts.length} icon={Users} tone="info" delay={0.02} />
        <StatCard
          label="Documents shared"
          value={docCount}
          icon={FileText}
          tone="default"
          hint={company.ndaStatus === 'fully_signed' ? 'NDA-protected docs unlocked' : 'Sign NDA to unlock more'}
          delay={0.06}
        />
        <StatCard
          label="NDA status"
          value={getLabel('ndaStatus', company.ndaStatus)}
          icon={FileSignature}
          tone={company.ndaStatus === 'fully_signed' ? 'success' : 'warning'}
          delay={0.1}
        />
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-subtle px-4 py-3 text-sm text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Your role has view-only access — ask your company owner to edit these details.</p>
        </div>
      )}

      <form id="profile-form" onSubmit={handleSave} className="space-y-6">
        {/* Company details */}
        <Section
          icon={Building2}
          title="Company details"
          description="Your registered company information."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Legal name"
              required
              error={errors.legalName}
              sensitive={canSensitive}
            >
              <Input
                value={form.legalName}
                onChange={(e) => set('legalName', e.target.value)}
                disabled={disabled}
                aria-invalid={!!errors.legalName}
              />
            </Field>
            <Field label="Trading name">
              <Input
                value={form.tradingName}
                onChange={(e) => set('tradingName', e.target.value)}
                disabled={disabled}
                placeholder="Brand / public name"
              />
            </Field>
            <Field label="Company type">
              <Select
                value={form.type}
                onValueChange={(v) => set('type', v as CompanyType)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {getLabel('companyType', t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Main activity">
              <Input
                value={form.mainActivity}
                onChange={(e) => set('mainActivity', e.target.value)}
                disabled={disabled}
                placeholder="e.g. Protein powders & bars"
              />
            </Field>
            <Field label="Website" error={errors.website}>
              <Input
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                disabled={disabled}
                placeholder="https://example.com"
                inputMode="url"
                aria-invalid={!!errors.website}
              />
            </Field>
            <Field label="VAT number" sensitive={canSensitive}>
              <Input
                value={form.vatNumber}
                onChange={(e) => set('vatNumber', e.target.value)}
                disabled={disabled}
                placeholder="e.g. GB 234 5678 90"
              />
            </Field>
            <Field label="Registration number">
              <Input
                value={form.registrationNumber}
                onChange={(e) => set('registrationNumber', e.target.value)}
                disabled={disabled}
              />
            </Field>
          </div>
          {canSensitive && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-teal" />
              Changes to legal name and VAT number are submitted to your Italprotein team for review before they take effect.
            </p>
          )}
        </Section>

        {/* Addresses */}
        <Section icon={MapPin} title="Addresses" description="Where we invoice and ship.">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold">Headquarters</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Address line">
                  <Input
                    value={form.hqLine1}
                    onChange={(e) => set('hqLine1', e.target.value)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={form.hqCity}
                    onChange={(e) => set('hqCity', e.target.value)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Postal code">
                  <Input
                    value={form.hqPostalCode}
                    onChange={(e) => set('hqPostalCode', e.target.value)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Country" required error={errors.hqCountry}>
                  <Input
                    value={form.hqCountry}
                    onChange={(e) => set('hqCountry', e.target.value)}
                    disabled={disabled}
                    aria-invalid={!!errors.hqCountry}
                  />
                </Field>
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Billing address</p>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={form.billingSameAsHq}
                    onCheckedChange={(v) => set('billingSameAsHq', v === true)}
                    disabled={disabled}
                  />
                  Same as headquarters
                </label>
              </div>
              {!form.billingSameAsHq && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Address line">
                    <Input
                      value={form.billingLine1}
                      onChange={(e) => set('billingLine1', e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="City">
                    <Input
                      value={form.billingCity}
                      onChange={(e) => set('billingCity', e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Postal code">
                    <Input
                      value={form.billingPostalCode}
                      onChange={(e) => set('billingPostalCode', e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Country">
                    <Input
                      value={form.billingCountry}
                      onChange={(e) => set('billingCountry', e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-sm font-semibold">Shipping address</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Default destination for sample deliveries.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Address line">
                  <Input
                    value={form.shippingLine1}
                    onChange={(e) => set('shippingLine1', e.target.value)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={form.shippingCity}
                    onChange={(e) => set('shippingCity', e.target.value)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Postal code">
                  <Input
                    value={form.shippingPostalCode}
                    onChange={(e) => set('shippingPostalCode', e.target.value)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Country">
                  <Input
                    value={form.shippingCountry}
                    onChange={(e) => set('shippingCountry', e.target.value)}
                    disabled={disabled}
                  />
                </Field>
              </div>
            </div>
          </div>
        </Section>

        {/* Profile preferences */}
        <Section
          icon={Settings2}
          title="Profile & preferences"
          description="How you'd like us to work with you."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred language">
              <Select
                value={form.preferredLanguage}
                onValueChange={(v) => set('preferredLanguage', v as Locale)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preferred currency">
              <Select
                value={form.preferredCurrency}
                onValueChange={(v) => set('preferredCurrency', v as Currency)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preferred communication method">
              <Select
                value={form.preferredCommunication}
                onValueChange={(v) => set('preferredCommunication', v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {COMMUNICATION_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="mt-4">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand-teal" />
              Main applications of interest
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick the categories you develop or sell — we tailor samples and documents to these.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {APPLICATION_CATEGORIES.map((cat) => {
                const checked = form.applicationInterests.includes(cat);
                return (
                  <label
                    key={cat}
                    className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleInterest(cat, v === true)}
                      disabled={disabled}
                    />
                    {getLabel('applicationCategory', cat)}
                  </label>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Logistics */}
        <Section
          icon={Truck}
          title="Logistics"
          description="Help us deliver your samples smoothly."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred courier">
              <Input
                value={form.preferredCourier}
                onChange={(e) => set('preferredCourier', e.target.value)}
                disabled={disabled}
                placeholder="e.g. DHL Express"
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Delivery instructions">
              <Textarea
                value={form.deliveryInstructions}
                onChange={(e) => set('deliveryInstructions', e.target.value)}
                disabled={disabled}
                placeholder="e.g. Goods-in, Mon–Fri 08:00–16:00."
              />
            </Field>
            <Field label="Logistics requirements">
              <Textarea
                value={form.logisticsRequirements}
                onChange={(e) => set('logisticsRequirements', e.target.value)}
                disabled={disabled}
                placeholder="Customs, temperature, documentation needs…"
              />
            </Field>
          </div>
        </Section>
      </form>

      {/* Contacts */}
      <ContactsSection
        companyId={company.id}
        contacts={contacts}
        canEdit={canEdit}
        onAdd={(c) => setContacts((prev) => [...prev, c])}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Discard unsaved changes?"
        description="Your edits to this profile will be reverted to the last saved version."
        confirmLabel="Discard changes"
        variant="danger"
        onConfirm={handleResetConfirmed}
      />
    </div>
  );
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  required,
  error,
  sensitive,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  sensitive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        {required && <span className="text-danger">*</span>}
        {sensitive && (
          <span
            title="Reviewed before applied"
            className="inline-flex items-center gap-0.5 rounded-full bg-brand-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-teal"
          >
            <ShieldCheck className="h-2.5 w-2.5" />
            Review
          </span>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ─────────────────────────── Contacts ─────────────────────────── */

const DECISION_ROLES: DecisionRole[] = [
  'decision_maker',
  'influencer',
  'gatekeeper',
  'champion',
  'user',
  'unknown',
];

function contactRoleLabel(c: Contact): string {
  if (c.jobTitle) return c.jobTitle;
  if (c.decisionRole) return getLabel('decisionRole', c.decisionRole);
  return '—';
}

function ContactsSection({
  companyId,
  contacts,
  canEdit,
  onAdd,
}: {
  companyId: string;
  contacts: Contact[];
  canEdit: boolean;
  onAdd: (c: Contact) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [decisionRole, setDecisionRole] = React.useState<DecisionRole>('user');
  const [saving, setSaving] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = firstName.trim() && lastName.trim() && emailValid;

  function reset() {
    setFirstName('');
    setLastName('');
    setJobTitle('');
    setEmail('');
    setDecisionRole('user');
    setTouched(false);
  }

  async function submit() {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));

    const contact: Contact = {
      id: uid('ct'),
      companyId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      jobTitle: jobTitle.trim() || undefined,
      decisionRole,
      email: email.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const created = await contactService.create(contact);
    onAdd(created);
    setSaving(false);
    setOpen(false);
    reset();
    toast({
      title: 'Contact added',
      description: `${created.firstName} ${created.lastName} is now on your team.`,
      variant: 'success',
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
              <Users className="h-4 w-4" />
            </span>
            Contacts
          </CardTitle>
          <CardDescription className="mt-1.5">
            People at your company we work with.
          </CardDescription>
        </div>
        {canEdit && (
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) reset();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" />
                Add contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a contact</DialogTitle>
                <DialogDescription>
                  Add a colleague so we can keep them in the loop on samples and projects.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ct-first">
                      First name <span className="text-danger">*</span>
                    </Label>
                    <Input
                      id="ct-first"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      aria-invalid={touched && !firstName.trim()}
                    />
                    {touched && !firstName.trim() && (
                      <p className="text-xs text-danger">First name is required.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ct-last">
                      Last name <span className="text-danger">*</span>
                    </Label>
                    <Input
                      id="ct-last"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      aria-invalid={touched && !lastName.trim()}
                    />
                    {touched && !lastName.trim() && (
                      <p className="text-xs text-danger">Last name is required.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ct-email">
                    Email <span className="text-danger">*</span>
                  </Label>
                  <Input
                    id="ct-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={touched && !emailValid}
                  />
                  {touched && !emailValid && (
                    <p className="text-xs text-danger">Enter a valid email address.</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ct-title">Job title</Label>
                    <Input
                      id="ct-title"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. R&D Manager"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select
                      value={decisionRole}
                      onValueChange={(v) => setDecisionRole(v as DecisionRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISION_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {getLabel('decisionRole', r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="button" variant="gold" onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? 'Adding…' : 'Add contact'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description={
              canEdit
                ? 'Add the colleagues you want us to work with.'
                : 'Your company owner can add team contacts here.'
            }
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {c.firstName} {c.lastName}
                    {c.isPrimary && (
                      <Badge variant="gold" className="text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{contactRoleLabel(c)}</p>
                </div>
                <a
                  href={`mailto:${c.email}`}
                  className="inline-flex items-center gap-1.5 text-sm text-brand-navy hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {c.email}
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
