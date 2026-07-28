import assert from 'node:assert/strict';
import test from 'node:test';
import { PromptOutputValidationError, parseInitialFactExtractionOutput } from '@universal/prompts';

test('package source imports and executes under Node strip-only TypeScript', () => {
  const parsed = parseInitialFactExtractionOutput(
    JSON.stringify({ interpretations: [], conflicts: [] })
  );
  assert.deepEqual(parsed, { interpretations: [], conflicts: [] });
  const error = new PromptOutputValidationError('$.value', 'expected a value.');
  assert.equal(error.path, '$.value');
});
