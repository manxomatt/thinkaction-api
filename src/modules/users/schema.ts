/**
 * MongoDB Schema
 *
 * https://www.mongodb.com/docs/current/core/schema-validation/update-schema-validation/
 * https://www.mongodb.com/docs/drivers/node/current/fundamentals/indexes/
 * https://www.mongodb.com/developer/products/mongodb/mongodb-schema-design-best-practices/
 */

import type { ISchema } from '@point-hub/papi';

import { collectionName } from './entity';

export const schema: ISchema[] = [
  {
    collection: collectionName,
    unique: [['email'], ['trimmed_email']],
    uniqueIfExists: [['username'], ['trimmed_username']],
    indexes: [],
    schema: {
      bsonType: 'object',
      required: ['email', 'username', 'name'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'The full name of the user.',
        },
        username: {
          bsonType: 'string',
          description: 'The unique username chosen by the user.',
        },
        trimmed_username: {
          bsonType: 'string',
          description: 'A normalized username used for uniqueness checks (spaces removed).',
        },
        email: {
          bsonType: 'string',
          description: 'The email address of the user.',
        },
        trimmed_email: {
          bsonType: 'string',
          description: 'A normalized email used for uniqueness checks (ignores dots and "+").',
        },
        password: {
          bsonType: 'string',
          description: 'The hashed password of the user.',
        },
        email_verification_code: {
          bsonType: 'string',
          description: 'The verification code used to confirm the user’s email.',
        },
        is_email_verified: {
          bsonType: 'bool',
          description: 'Indicates whether the user’s email has been verified.',
        },
        fcm_tokens: {
          bsonType: 'array',
          description: 'Array of FCM tokens for push notifications.',
          items: {
            bsonType: 'object',
            properties: {
              token: {
                bsonType: 'string',
                description: 'The FCM device token.',
              },
              device_id: {
                bsonType: 'string',
                description: 'Unique identifier for the device.',
              },
              device_type: {
                bsonType: 'string',
                enum: ['ios', 'android', 'web'],
                description: 'The type of device (ios, android, or web).',
              },
              created_at: {
                bsonType: 'date',
                description: 'Timestamp when the token was registered.',
              },
              updated_at: {
                bsonType: 'date',
                description: 'Timestamp when the token was last updated.',
              },
            },
          },
        },
        created_at: {
          bsonType: 'date',
          description: 'Timestamp indicating when the user account was created.',
        },
        updated_at: {
          bsonType: 'date',
          description: 'Timestamp indicating when the user account was updated.',
        },
      },
    },
  },
];
