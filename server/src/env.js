import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

// 兼容从 server/ 目录或项目根目录启动：优先 ../.env，兜底 ./.env
const parentEnv = path.resolve(process.cwd(), '../.env');
const localEnv = path.resolve(process.cwd(), '.env');
dotenv.config({ path: fs.existsSync(parentEnv) ? parentEnv : localEnv });
