import knex from 'knex';
import { knexConfig } from './knexConfig.js';

export const db = knex(knexConfig);
