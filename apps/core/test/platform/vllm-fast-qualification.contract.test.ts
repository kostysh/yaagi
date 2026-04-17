import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')) as T;

type Manifest = {
  serviceId: string;
  preferredCandidateId: string;
  selectedCandidateId: string | null;
  selectionState: string;
  qualificationReportPath?: string;
  mustPassGates: string[];
  candidates: Array<{
    candidateId: string;
    modelId: string;
    selectionRole: string;
  }>;
};

type QualificationReport = {
  serviceId: string;
  selectedCandidateId: string | null;
  selectionState: string;
  results: Array<{
    candidateId: string;
    modelId: string;
    passedGates: boolean;
    gateResults: Record<string, boolean>;
  }>;
};

void test('AC-F0020-02 / AC-F0020-03 / AC-F0020-12 keeps the canonical Gemma baseline qualified against the must-pass real-serving gate set', () => {
  const manifest = readJson<Manifest>('../../../../seed/models/base/vllm-fast-manifest.json');
  assert.ok(manifest.qualificationReportPath);
  const report = readJson<QualificationReport>(`../../../../${manifest.qualificationReportPath}`);

  assert.equal(manifest.serviceId, 'vllm-fast');
  assert.equal(report.serviceId, 'vllm-fast');
  assert.equal(manifest.selectionState, 'qualified');
  assert.equal(report.selectionState, 'qualified');
  assert.equal(manifest.preferredCandidateId, 'gemma-4-e4b-it');
  assert.equal(manifest.selectedCandidateId, 'gemma-4-e4b-it');
  assert.equal(report.selectedCandidateId, 'gemma-4-e4b-it');

  const manifestCandidate = manifest.candidates.find(
    (candidate) => candidate.candidateId === manifest.selectedCandidateId,
  );
  const result = report.results.find(
    (candidate) => candidate.candidateId === report.selectedCandidateId,
  );

  assert.equal(manifestCandidate?.candidateId, 'gemma-4-e4b-it');
  assert.equal(manifestCandidate?.modelId, 'google/gemma-4-E4B-it');
  assert.equal(manifestCandidate?.selectionRole, 'preferred');
  assert.equal(result?.modelId, 'google/gemma-4-E4B-it');
  assert.equal(result?.passedGates, true);
  assert.deepEqual(
    Object.keys(result?.gateResults ?? {}).sort(),
    [...manifest.mustPassGates].sort(),
  );
  assert.ok(Object.values(result?.gateResults ?? {}).every((gate) => gate === true));
});
