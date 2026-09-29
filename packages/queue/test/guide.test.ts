import test from 'node:test';
import { example } from '../examples/usage.js';

test(
  'documented composition example compiles and completes through production exports',
  example,
);
