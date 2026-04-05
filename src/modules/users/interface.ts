export interface IFcmToken {
  token: string
  device_id?: string
  device_type?: 'ios' | 'android' | 'web'
  created_at?: Date
  updated_at?: Date
}

export interface IUserEntity {
  _id?: string
  name?: string
  username?: string
  trimmed_username?: string
  email?: string
  trimmed_email?: string
  password?: string
  email_verification?: {
    code?: string
    url?: string
    requested_at?: Date
    is_verified?: boolean
    verified_at?: Date
  }
  request_password?: {
    requested_at?: Date
    code?: string
    url?: string
  }
  profile?: {
    status?: string
    bio?: string
  }
  avatar_url?: string
  avatar?: {
    public_domain?: string
    public_path?: string
  }
  private_account?: boolean
  fcm_tokens?: IFcmToken[]
  created_at?: Date
  updated_at?: Date
}
