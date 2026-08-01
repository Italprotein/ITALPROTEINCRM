'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarPlus, Loader2 } from 'lucide-react';

import type { Company, Meeting, MeetingType } from '@/lib/types';
import { createMeetingWithNotifications } from '@/lib/services/meeting.actions';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { useSession } from '@/components/providers/session-provider';
import { getLabel } from '@/lib/labels';
import { uid } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

// Labels come from the shared locale-aware map (lib/labels.ts), so this list
// only declares which types the dialog offers.
const CALL_TYPES: MeetingType[] = ['video_call', 'phone_call', 'technical_call', 'on_site'];

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ScheduleCallDialog({
  open,
  onOpenChange,
  companies,
  initialDate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  initialDate?: Date | null;
  onCreated: (meeting: Meeting) => void;
}) {
  const t = useTranslations('AdminCalendar');
  const { account } = useSession();
  const staff = useStaffDirectory();
  const { toast } = useToast();
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<MeetingType>('video_call');
  const [companyId, setCompanyId] = React.useState('none');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [agenda, setAgenda] = React.useState('');
  const [recipients, setRecipients] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const base = initialDate ? new Date(initialDate) : new Date();
    if (initialDate) base.setHours(9, 0, 0, 0);
    else base.setMinutes(Math.ceil(base.getMinutes() / 15) * 15, 0, 0);
    const finish = new Date(base.getTime() + 30 * 60_000);
    setStart(localDateTime(base));
    setEnd(localDateTime(finish));
  }, [open, initialDate]);

  function toggleRecipient(id: string) {
    setRecipients((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!account || !title.trim() || !start || !end || new Date(end) <= new Date(start)) return;
    setSaving(true);
    try {
      const meeting: Meeting = {
        id: uid('meeting'),
        title: title.trim(),
        type,
        companyId: companyId === 'none' ? undefined : companyId,
        ownerId: account.id,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        location: location.trim() || undefined,
        agenda: agenda.trim() || undefined,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };
      const created = await createMeetingWithNotifications(meeting, [...recipients]);
      onCreated(created);
      onOpenChange(false);
      setTitle('');
      setLocation('');
      setAgenda('');
      setRecipients(new Set());
      toast({
        title: t('toastCallScheduled'),
        description: recipients.size
          ? t('toastCallNotified', { count: recipients.size })
          : t('toastCallPlain'),
      });
    } catch {
      toast({ title: t('toastCallFailed'), description: t('toastCallFailedDescription') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-brand-teal" />
              {t('scheduleDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('scheduleDialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="call-title">{t('callTitleLabel')}</Label>
              <Input id="call-title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t('callTitlePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('callTypeLabel')}</Label>
              <Select value={type} onValueChange={(value) => setType(value as MeetingType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CALL_TYPES.map((value) => <SelectItem key={value} value={value}>{getLabel('meetingType', value)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('callCompanyLabel')}</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder={t('callCompanyPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('callInternalOption')}</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.tradingName || company.legalName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="call-start">{t('callStartsLabel')}</Label>
              <Input id="call-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="call-end">{t('callEndsLabel')}</Label>
              <Input id="call-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} min={start} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="call-location">{t('callLocationLabel')}</Label>
              <Input id="call-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('callLocationPlaceholder')} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="call-agenda">{t('callAgendaLabel')}</Label>
              <Textarea id="call-agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder={t('callAgendaPlaceholder')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('callNotifyLabel')}</Label>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
              {staff.staff.filter((member) => member.id !== account?.id).map((member) => (
                <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                  <input type="checkbox" checked={recipients.has(member.id)} onChange={() => toggleRecipient(member.id)} className="h-4 w-4 accent-brand-teal" />
                  <span className="h-8 w-8 rounded-full bg-brand-navy/10 text-center text-xs font-semibold leading-8 text-brand-navy">
                    {member.firstName[0]}{member.lastName[0]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{member.firstName} {member.lastName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{member.jobTitle || member.email}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('callCancel')}</Button>
            <Button type="submit" variant="gold" disabled={saving || !title.trim() || !start || !end}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('scheduleCall')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
