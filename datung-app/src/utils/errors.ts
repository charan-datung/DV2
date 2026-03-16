/**
 * Error normalization and user-friendly error messages in Tagalog.
 */

export function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'May nangyaring mali';
}

export function userFriendlyError(err: unknown): string {
  const msg = normalizeError(err);

  if (/network|fetch|connect|timeout/i.test(msg)) {
    return 'Walang koneksyon. Suriin ang internet at subukan muli.';
  }
  if (/rate.*limit|too many/i.test(msg)) {
    return 'Maraming pagsubok. Maghintay ng ilang minuto bago ulitin.';
  }
  if (/unauthorized|not.*auth|jwt/i.test(msg)) {
    return 'Kailangan mag-login muli.';
  }
  if (/permission|forbidden|policy/i.test(msg)) {
    return 'Hindi pinapayagan ang aksyon na ito.';
  }
  if (/not.*found|no rows/i.test(msg)) {
    return 'Hindi nahanap ang hinahanap.';
  }
  if (/insufficient.*balance/i.test(msg)) {
    return 'Kulang ang available balance ng tindahan.';
  }
  if (/duplicate|unique|already exists/i.test(msg)) {
    return 'Mayroon nang ganitong record.';
  }

  return 'May nangyaring mali. Subukan muli.';
}
