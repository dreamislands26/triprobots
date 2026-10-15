const patterns = [
  { type: 'EMAIL', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { type: 'PHONE', regex: /(?:\+?7|8)?[\s()-]*\d{3}[\s()-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g },
  { type: 'TELEGRAM', regex: /@[A-Za-z0-9_]{5,32}/g }
];

export function maskPersonalData(input = '') {
  const replacements = [];
  let text = String(input);

  for (const { type, regex } of patterns) {
    text = text.replace(regex, (value) => {
      const token = `[${type}_${replacements.filter(x => x.type === type).length + 1}]`;
      replacements.push({ token, value, type });
      return token;
    });
  }

  return { text, replacements };
}

export function restorePersonalData(input = '', replacements = []) {
  return replacements.reduce((text, item) => text.split(item.token).join(item.value), String(input));
}