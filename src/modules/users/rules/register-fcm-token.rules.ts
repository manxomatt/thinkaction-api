export const registerFcmTokenRules = {
  token: 'required|string',
  device_id: 'string',
  device_type: 'string|in:ios,android,web',
};
