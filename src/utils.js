export function sanitizeCode(input) {
  if (typeof input !== 'string')
    return;

  return input.replace('`', '\'');
}

export function isPositiveInteger(input) {
  return /^\+?(0|[1-9]\d*)$/.test(input);
}
