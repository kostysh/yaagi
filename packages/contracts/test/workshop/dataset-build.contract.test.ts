import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidDatasetBuildRequest,
  isSafeDatasetRedactionProfile,
} from '../../src/workshop.ts';

void test('AC-F0015-03 accepts only bounded dataset-build inputs with reviewed provenance and redaction metadata', () => {
  assert.equal(isSafeDatasetRedactionProfile('episodes-redacted-v1'), true);

  assert.doesNotThrow(() =>
    assertValidDatasetBuildRequest({
      requestId: 'dataset-build-1',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-1', 'episode-2'],
      sourceEvalRunIds: [],
      redactionProfile: 'episodes-redacted-v1',
    }),
  );
});

void test('AC-F0015-09 rejects raw or source-less dataset requests before they can become canonical train-set input', () => {
  assert.throws(
    () =>
      assertValidDatasetBuildRequest({
        requestId: 'dataset-build-raw',
        datasetKind: 'sft',
        sourceEpisodeIds: ['episode-1'],
        sourceEvalRunIds: [],
        redactionProfile: 'raw',
      }),
    /reviewed redaction profile/,
  );

  assert.throws(
    () =>
      assertValidDatasetBuildRequest({
        requestId: 'dataset-build-empty',
        datasetKind: 'eval',
        sourceEpisodeIds: [],
        sourceEvalRunIds: [],
        redactionProfile: 'episodes-redacted-v1',
      }),
    /requires bounded episode or eval sources/,
  );
});
