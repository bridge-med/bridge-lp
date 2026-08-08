/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'CareerLogWidget',
  // Shared container so the widget can read data written by the app.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.bridgemed.worklog'],
  },
};
