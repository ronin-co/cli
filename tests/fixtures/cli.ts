#!/usr/bin/env bun

import { version } from '@/src/../package.json';
import runCLI from '../../dist/index.js';

runCLI({ version });
