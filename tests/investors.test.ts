import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  investorStatistics,
  investorStatusFromLabel,
  normalizeDomain,
  parseCsv,
  parseInvestorsCsv,
  parseItalianDate,
  splitEmails,
} from '@/lib/investors';

describe('parseCsv', () => {
  it('handles quoted fields with embedded commas and doubled quotes', () => {
    const rows = parseCsv('a,"b, with comma","say ""hi"""\nc,d,e');
    expect(rows).toEqual([
      ['a', 'b, with comma', 'say "hi"'],
      ['c', 'd', 'e'],
    ]);
  });

  it('handles CRLF and a UTF-8 BOM', () => {
    const rows = parseCsv('﻿x,y\r\n1,2\r\n');
    expect(rows).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('parseItalianDate', () => {
  it('parses dd/MM/yyyy at UTC midnight', () => {
    expect(parseItalianDate('26/08/2026')?.toISOString()).toBe('2026-08-26T00:00:00.000Z');
  });
  it('rejects blanks, garbage and rollover dates', () => {
    expect(parseItalianDate('')).toBeUndefined();
    expect(parseItalianDate('yesterday')).toBeUndefined();
    expect(parseItalianDate('31/02/2026')).toBeUndefined();
  });
});

describe('splitEmails', () => {
  it('splits on semicolons, lowercases and drops junk', () => {
    expect(splitEmails('Info@Fund.com; x; partner@fund.com ')).toEqual([
      'info@fund.com',
      'partner@fund.com',
    ]);
    expect(splitEmails(undefined)).toEqual([]);
  });
});

describe('normalizeDomain', () => {
  it('lowercases, strips www and refuses non-hosts', () => {
    expect(normalizeDomain('www.360Cap.VC')).toBe('360cap.vc');
    expect(normalizeDomain('nodots')).toBeUndefined();
    expect(normalizeDomain('')).toBeUndefined();
  });
});

describe('investorStatusFromLabel', () => {
  it('maps the four workbook labels and refuses anything else', () => {
    expect(investorStatusFromLabel('In contatto')).toBe('in_contact');
    expect(investorStatusFromLabel('  da RICONTATTARE ')).toBe('to_recontact');
    expect(investorStatusFromLabel('Rifiutato')).toBe('rejected');
    expect(investorStatusFromLabel('Primo contatto')).toBe('first_contact');
    expect(investorStatusFromLabel('Perso')).toBeNull();
  });
});

const HEADER =
  'Azienda,Stato,Email,Paese,Città,Dominio,Data primo contatto,Data ultimo contatto,Tipo di riscontro,Dettagli / prossimo passo,Link email';

describe('parseInvestorsCsv', () => {
  it('maps a row end to end', () => {
    const csv = `${HEADER}\n360 Capital,In contatto,info@360cap.vc; sonaly@360cap.vc,Francia,Parigi,360cap.vc,26/08/2026,26/08/2026,Valutazione manuale,"Richiesto upload del deck, con dettagli.",https://mail.google.com/mail/#all/1a0`;
    const { inputs, issues } = parseInvestorsCsv(csv);
    expect(issues).toEqual([]);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      name: '360 Capital',
      status: 'in_contact',
      emails: ['info@360cap.vc', 'sonaly@360cap.vc'],
      country: 'Francia',
      city: 'Parigi',
      domain: '360cap.vc',
      nextStep: 'Richiesto upload del deck, con dettagli.',
      gmailUrl: 'https://mail.google.com/mail/#all/1a0',
    });
    expect(inputs[0].firstContactAt?.toISOString()).toBe('2026-08-26T00:00:00.000Z');
  });

  it('reports rows with no name or an unknown status instead of guessing', () => {
    const csv = `${HEADER}\n,In contatto,,,,,,,,,\nFondo X,Perso,,,,,,,,,`;
    const { inputs, issues } = parseInvestorsCsv(csv);
    expect(inputs).toEqual([]);
    expect(issues.map((i) => i.reason)).toEqual(['missing_name', 'unknown_status']);
  });

  it('survives a re-export with reordered columns', () => {
    const csv = 'Stato,Azienda,Email\nRifiutato,Fondo Y,x@y.com';
    const { inputs } = parseInvestorsCsv(csv);
    expect(inputs[0]).toMatchObject({ name: 'Fondo Y', status: 'rejected', emails: ['x@y.com'] });
  });
});

describe('investorStatistics', () => {
  it('tallies per status', () => {
    const stats = investorStatistics([
      { status: 'in_contact' },
      { status: 'in_contact' },
      { status: 'rejected' },
      { status: 'first_contact' },
    ]);
    expect(stats).toEqual({ total: 4, inContact: 2, toRecontact: 0, rejected: 1, firstContact: 1 });
  });
});

/* The real workbook lives in assets/ (gitignored — real outreach data stays out
 * of the repo), so this validation runs where the file exists and is skipped
 * elsewhere. The expected numbers are the workbook's own Sintesi sheet. */
const CSV_PATH = path.resolve(
  __dirname,
  '..',
  'assets/Investitori/Investitori_Stato_Contatti-Contatti.csv',
);

describe.skipIf(!existsSync(CSV_PATH))('real workbook export', () => {
  it('parses all 562 rows and matches the Sintesi tallies', () => {
    const { inputs, issues } = parseInvestorsCsv(readFileSync(CSV_PATH, 'utf8'));
    expect(issues).toEqual([]);
    const stats = investorStatistics(inputs);
    expect(stats).toEqual({
      total: 562,
      inContact: 13,
      toRecontact: 90,
      rejected: 2,
      firstContact: 457,
    });
    // Every name is unique — the importer's upsert key.
    expect(new Set(inputs.map((i) => i.name)).size).toBe(inputs.length);
  });
});
