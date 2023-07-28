const path = require('path');

//require('dotenv').config({ path: path.resolve(__dirname, './.env') });
jest.mock('ioredis', () => jest.requireActual('ioredis-mock'));
//jest.mock('redis', () => jest.requireActual('redis-mock'));
