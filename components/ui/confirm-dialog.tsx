'use client';

import * as React from 'react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmRequest = Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>;

/**
 * Convenience hook for imperative confirmations.
 *
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   <button onClick={() => confirm({ title: 'Delete?', variant: 'danger' }).then(ok => ...)} />
 *   {ConfirmDialog}
 */
export function useConfirm() {
  const [state, setState] = React.useState<ConfirmRequest | null>(null);
  const resolver = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback((request: ConfirmRequest) => {
    setState(request);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handleOpenChange = React.useCallback((next: boolean) => {
    if (!next) {
      resolver.current?.(false);
      resolver.current = null;
      setState(null);
    }
  }, []);

  const handleConfirm = React.useCallback(() => {
    resolver.current?.(true);
    resolver.current = null;
  }, []);

  const dialog = state ? (
    <ConfirmDialog
      open
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      {...state}
    />
  ) : null;

  return { confirm, ConfirmDialog: dialog } as const;
}
