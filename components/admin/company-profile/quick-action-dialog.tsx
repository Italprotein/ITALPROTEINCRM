'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { sleep } from '@/lib/utils';

export interface QuickField {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'date' | 'number';
  required?: boolean;
  defaultValue?: string;
}

interface QuickActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: QuickField[];
  submitLabel?: string;
  /** Called with the collected values; should perform the mock mutation. */
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

/**
 * Reusable lightweight form dialog for the company-profile quick actions
 * (log activity, create task, add note, request sample, add contact …).
 * Simulates a 500ms async mutation, then closes.
 */
export function QuickActionDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  submitLabel = 'Save',
  onSubmit,
}: QuickActionDialogProps) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  // Reset form whenever the dialog (re)opens.
  React.useEffect(() => {
    if (open) {
      const seed: Record<string, string> = {};
      for (const f of fields) seed[f.name] = f.defaultValue ?? '';
      setValues(seed);
      setSubmitting(false);
    }
  }, [open, fields]);

  const missingRequired = fields.some((f) => f.required && !values[f.name]?.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingRequired || submitting) return;
    setSubmitting(true);
    try {
      await sleep(500);
      await onSubmit(values);
      onOpenChange(false);
    } catch {
      // keep the dialog open so the user can retry
      toast({ title: 'Action failed', description: 'Please try again.', variant: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="grid gap-4">
            {fields.map((f) => (
              <div key={f.name} className="grid gap-1.5">
                <Label htmlFor={`qa-${f.name}`}>
                  {f.label}
                  {f.required && <span className="ml-0.5 text-danger">*</span>}
                </Label>
                {f.type === 'textarea' ? (
                  <Textarea
                    id={`qa-${f.name}`}
                    placeholder={f.placeholder}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                ) : (
                  <Input
                    id={`qa-${f.name}`}
                    type={f.type ?? 'text'}
                    placeholder={f.placeholder}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={missingRequired || submitting}>
              {submitting ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
