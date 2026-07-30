'use client';

import * as React from 'react';
import Image from 'next/image';
import { ShieldCheck, ShieldAlert, Copy, Check, KeyRound, Loader2 } from 'lucide-react';

import {
  getMfaStatus,
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableMfa,
  regenerateBackupCodes,
  type MfaStatus,
} from '@/lib/services/mfa.actions';
import { PageHeader } from '@/components/shared/page-header';
import { ChangePasswordCard } from '@/components/admin/change-password-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';

const ERRORS: Record<string, string> = {
  invalid_code: "That code didn't match. Check your authenticator app and try again.",
  not_enrolled: 'Start the setup again — the previous attempt expired.',
  already_enrolled: 'Two-factor authentication is already active on this account.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
};

export function MfaSetup() {
  const [status, setStatus] = React.useState<MfaStatus | null>(null);
  const [challenge, setChallenge] = React.useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [copied, setCopied] = React.useState(false);

  const refresh = React.useCallback(() => {
    getMfaStatus().then(setStatus);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function start() {
    setBusy(true);
    const result = await beginTotpEnrollment();
    setBusy(false);
    if ('error' in result) {
      toast({ variant: 'danger', title: 'Cannot start setup', description: ERRORS[result.error] });
      return;
    }
    setChallenge(result);
    setCode('');
  }

  async function confirm() {
    if (code.trim().length < 6) return;
    setBusy(true);
    const result = await confirmTotpEnrollment(code.trim());
    setBusy(false);
    if (!result.ok) {
      toast({ variant: 'danger', title: 'Not verified', description: ERRORS[result.error ?? 'invalid_code'] });
      return;
    }
    setChallenge(null);
    setCode('');
    setBackupCodes(result.backupCodes ?? null);
    refresh();
    toast({ variant: 'success', title: 'Two-factor authentication enabled' });
  }

  async function regenerate() {
    if (code.trim().length < 6) {
      toast({ variant: 'danger', title: 'Enter a current code first' });
      return;
    }
    setBusy(true);
    const result = await regenerateBackupCodes(code.trim());
    setBusy(false);
    if (!result.ok) {
      toast({ variant: 'danger', title: 'Not verified', description: ERRORS[result.error ?? 'invalid_code'] });
      return;
    }
    setCode('');
    setBackupCodes(result.backupCodes ?? null);
    refresh();
  }

  async function turnOff() {
    setBusy(true);
    const result = await disableMfa(code.trim());
    setBusy(false);
    if (!result.ok) {
      toast({ variant: 'danger', title: 'Not disabled', description: ERRORS[result.error ?? 'invalid_code'] });
      return;
    }
    setCode('');
    refresh();
    toast({ title: 'Two-factor authentication disabled' });
  }

  function copyCodes() {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!status) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        subtitle="Manage your password and two-factor authentication."
      />

      {/* Available to every internal role — unlike Settings, which is
          super_admin only, this page manages your OWN account. */}
      <ChangePasswordCard />

      {/* One-time backup codes. Shown immediately after they are issued and
          never again — the server only stores their hashes. */}
      {backupCodes && (
        <Card className="max-w-2xl border-warning/50 bg-warning-subtle">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-warning-foreground" />
              <h2 className="font-semibold text-warning-foreground">Save your recovery codes now</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Each code works once, and they are the only way back in if you lose your phone.
              <strong className="text-foreground"> They will never be shown again.</strong>
            </p>
            <ul className="grid grid-cols-2 gap-1.5 rounded-lg border bg-background p-3 font-mono text-sm sm:grid-cols-3">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyCodes}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy codes'}
              </Button>
              <Button size="sm" onClick={() => setBackupCodes(null)}>
                I have saved them
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-2xl">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={
                  status.enrolled
                    ? 'flex h-10 w-10 items-center justify-center rounded-lg bg-success-subtle text-success-foreground'
                    : 'flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground'
                }
              >
                {status.enrolled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
              </span>
              <div>
                <h2 className="font-semibold">Two-factor authentication</h2>
                <p className="text-sm text-muted-foreground">
                  A 6-digit code from your authenticator app, in addition to your password.
                </p>
              </div>
            </div>
            {status.enrolled ? (
              <Badge variant="success">Active</Badge>
            ) : status.required ? (
              <Badge variant="warning">Required</Badge>
            ) : (
              <Badge variant="muted">Off</Badge>
            )}
          </div>

          {status.required && !status.enrolled && (
            <p className="rounded-lg border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-foreground">
              Your role administers other accounts, so two-factor authentication is required.
              Please finish setup now.
            </p>
          )}

          {/* ── Not enrolled: run the setup ── */}
          {!status.enrolled && !challenge && (
            <Button onClick={start} disabled={busy} variant="gold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Set up two-factor authentication
            </Button>
          )}

          {!status.enrolled && challenge && (
            <div className="space-y-4 rounded-lg border p-4">
              <ol className="list-decimal space-y-3 pl-5 text-sm">
                <li>
                  Scan this with Google Authenticator, 1Password, Authy or Bitwarden:
                  <div className="mt-2 w-fit rounded-lg border bg-white p-2">
                    <Image
                      src={challenge.qrDataUrl}
                      alt="Two-factor setup QR code"
                      width={180}
                      height={180}
                      unoptimized
                    />
                  </div>
                </li>
                <li>
                  Or enter this key by hand:
                  <code className="ml-1 select-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {challenge.secret}
                  </code>
                </li>
                <li>
                  Enter the 6-digit code it shows:
                  <div className="mt-2 flex max-w-xs gap-2">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      className="tracking-widest"
                    />
                    <Button onClick={confirm} disabled={busy || code.trim().length < 6}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* ── Enrolled: manage ── */}
          {status.enrolled && (
            <div className="space-y-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between rounded-lg border p-3">
                  <dt className="text-muted-foreground">Recovery codes left</dt>
                  <dd className="font-medium tabular">{status.backupCodesRemaining}</dd>
                </div>
                {status.enrolledAt && (
                  <div className="flex justify-between rounded-lg border p-3">
                    <dt className="text-muted-foreground">Enabled</dt>
                    <dd className="font-medium">{new Date(status.enrolledAt).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>

              {status.backupCodesRemaining <= 2 && (
                <p className="rounded-lg border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-foreground">
                  You are nearly out of recovery codes. Generate a new set below.
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="mfa-current">Current code from your app</Label>
                <div className="flex max-w-xs gap-2">
                  <Input
                    id="mfa-current"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="tracking-widest"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>
                    <KeyRound className="h-4 w-4" /> New recovery codes
                  </Button>
                  {!status.required && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={turnOff}
                      disabled={busy}
                      className="text-danger focus:text-danger"
                    >
                      Turn off
                    </Button>
                  )}
                </div>
                {status.required && (
                  <p className="text-xs text-muted-foreground">
                    Two-factor authentication cannot be turned off for your role.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
