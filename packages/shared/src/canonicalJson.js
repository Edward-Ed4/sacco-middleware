'use strict';

function canonicaliseJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => canonicaliseJson(item) ?? 'null').join(',')}]`;
  }

  const entries = Object.keys(value)
    .sort()
    .filter(key => value[key] !== undefined && typeof value[key] !== 'function')
    .map(key => `${JSON.stringify(key)}:${canonicaliseJson(value[key])}`);

  return `{${entries.join(',')}}`;
}

module.exports = { canonicaliseJson };
