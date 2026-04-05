export const broadcastPushNotificationRules = {
  title: ['required', 'string', 'min:1', 'max:100'],
  body: ['required', 'string', 'min:1', 'max:500'],
  image_url: ['string'],
  user_ids: ['array'],
  'user_ids.*': ['string'],
  data: ['object'],
};
