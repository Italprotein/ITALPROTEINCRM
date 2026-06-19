'use client';

import * as React from 'react';
import { SlidersHorizontal, Users2, Database, Save, RotateCcw, Palette, BellRing, Building2 } from 'lucide-react';
import {
  companyService, sampleService, ndaService, documentService, taskService, userService,
} from '@/lib/mock-services';
import { resetDemoData } from '@/lib/demo';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';

const NOTIF_PREFS = [
  'New company registrations', 'NDA status changes', 'New sample requests',
  'Shipment dispatched & delivered', 'Delivery delays', 'Feedback received',
  'Task reminders', 'Invoice overdue',
];

export default function SettingsPage() {
  const [counts, setCounts] = React.useState<{ records: number; team: number } | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // General form state
  const [orgName, setOrgName] = React.useState('Italprotein Srl');
  const [currency, setCurrency] = React.useState('EUR');
  const [language, setLanguage] = React.useState('en');
  const [timezone, setTimezone] = React.useState('Europe/Rome');
  const [density, setDensity] = React.useState('comfortable');

  React.useEffect(() => {
    Promise.all([
      companyService.list(), sampleService.list(), ndaService.list(),
      documentService.list(), taskService.list(), userService.getStatistics(),
    ]).then(([c, s, n, d, t, u]) => {
      setCounts({ records: c.length + s.length + n.length + d.length + t.length, team: u.total });
    });
  }, []);

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    toast({ variant: 'success', title: 'Settings saved', description: 'Your workspace preferences were updated.' });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settings" subtitle="Configure your ITALPROTEIN CRM workspace." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Modules enabled" value={22} icon={SlidersHorizontal} tone="gold" />
        <StatCard label="Team members" value={counts?.team ?? 0} icon={Users2} tone="info" delay={0.05} />
        <StatCard label="Data records" value={counts?.records ?? 0} icon={Database} tone="success" delay={0.1} />
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><Building2 className="mr-1.5 h-4 w-4" /> General</TabsTrigger>
          <TabsTrigger value="notifications"><BellRing className="mr-1.5 h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="mr-1.5 h-4 w-4" /> Appearance</TabsTrigger>
          <TabsTrigger value="demo"><Database className="mr-1.5 h-4 w-4" /> Demo data</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="org">Organisation name</Label><Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Default currency</Label>
                <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['EUR', 'USD', 'GBP', 'CHF'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Default language</Label>
                <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="it">Italiano</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="tz">Timezone</Label><Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
              <div className="flex items-end"><Button variant="gold" onClick={save} disabled={saving}><Save /> {saving ? 'Saving…' : 'Save changes'}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>Email triggers</CardTitle><p className="text-sm text-muted-foreground">Choose which events send a notification email (simulated in demo).</p></CardHeader>
            <CardContent className="divide-y">
              {NOTIF_PREFS.map((l, i) => (
                <div key={l} className="flex items-center justify-between py-3"><Label className="font-normal">{l}</Label><Switch defaultChecked={i < 6} /></div>
              ))}
              <div className="pt-3"><Button variant="gold" onClick={save} disabled={saving}><Save /> {saving ? 'Saving…' : 'Save preferences'}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">Light / dark theme can be toggled any time from the sun/moon button in the top bar.</div>
              <div className="space-y-1.5 max-w-xs"><Label>Default table density</Label>
                <Select value={density} onValueChange={setDensity}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="comfortable">Comfortable</SelectItem><SelectItem value="compact">Compact</SelectItem></SelectContent></Select>
              </div>
              <Button variant="gold" onClick={save} disabled={saving}><Save /> {saving ? 'Saving…' : 'Save'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demo">
          <Card>
            <CardHeader><CardTitle>Demo data</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This prototype runs entirely on seeded mock data with a browser-local overlay for your edits. Resetting restores the original demo dataset and signs you out.
              </p>
              <Button variant="destructive" onClick={() => setResetOpen(true)}><RotateCcw /> Reset demo data</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset all demo data?"
        description="This clears every local edit (companies, samples, NDAs, tasks…) and restores the seeded dataset. You will be signed out."
        confirmLabel="Reset everything"
        variant="danger"
        onConfirm={resetDemoData}
      />
    </div>
  );
}
