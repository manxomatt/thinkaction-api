import type { IDatabase } from '@point-hub/papi';

import { collectionName } from '../entity';

export interface IRetrieveByUsernameRepository {
  handle(username: string): Promise<IRetrieveByUsernameOutput | null>
}

export interface IRetrieveByUsernameOutput {
  _id: string
  name: string
  username: string
  email: string
  fcm_token?: string
  profile?: {
    status?: string
    bio?: string
  }
  avatar?: {
    public_domain?: string
    public_path?: string
  }
  private_account?: boolean
  created_at?: Date
  updated_at?: Date
}

export class RetrieveByUsernameRepository implements IRetrieveByUsernameRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(username: string): Promise<IRetrieveByUsernameOutput | null> {
    const trimmedUsername = username.split(' ').join('').toLowerCase();

    const response = await this.database.collection(collectionName).retrieveAll(
      {
        filter: {
          trimmed_username: {
            $regex: `^${trimmedUsername}$`,
            $options: 'i',
          },
        },
        page: 1,
        pageSize: 1,
      },
      this.options,
    );

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const user = response.data[0] as Record<string, unknown>;

    return {
      _id: user['_id'] as string,
      name: user['name'] as string,
      username: user['username'] as string,
      email: user['email'] as string,
      fcm_token: user['fcm_token'] as string | undefined,
      profile: user['profile'] as {
        status?: string
        bio?: string
      } | undefined,
      avatar: user['avatar'] as {
        public_domain?: string
        public_path?: string
      } | undefined,
      private_account: user['private_account'] as boolean | undefined,
      created_at: user['created_at'] as Date | undefined,
      updated_at: user['updated_at'] as Date | undefined,
    };
  }
}
