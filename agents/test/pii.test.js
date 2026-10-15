import test from 'node:test';
import assert from 'node:assert/strict';
import { maskPersonalData, restorePersonalData } from '../src/shared/pii.js';

test('masks email, phone and telegram username', () => {
  const source = 'Пишите test@example.com, +7 (921) 555-44-33, @triprobots_bot';
  const masked = maskPersonalData(source);
  assert.equal(masked.text.includes('test@example.com'), false);
  assert.equal(masked.text.includes('921'), false);
  assert.equal(masked.text.includes('@triprobots_bot'), false);
  assert.equal(restorePersonalData(masked.text, masked.replacements), source);
});

test('does not change ordinary business text', () => {
  const source = 'Нужна интеграция с 1С и Битрикс24';
  assert.equal(maskPersonalData(source).text, source);
});