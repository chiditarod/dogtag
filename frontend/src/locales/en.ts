export const en = {
  'app.title': 'CHIditarod Registration',
  'layout.logoAlt': 'CHIditarod',
  'layout.userMenu': 'Account',
  'layout.login': 'Log in',
  'layout.signup': 'Sign up',
  'races.heading': 'Choose your race',
  'login.heading': 'Log in',
  'signup.heading': 'Create your account',
  'forgotPassword.heading': 'Reset your password',
  'teams.newHeading': 'Create your team',
  'teams.listHeading': 'My teams',
  'teams.checklistHeading': 'Team checklist',
  'notFound.heading': 'Page not found',
  'notFound.body': 'We could not find the page you were looking for.',
  'notFound.home': 'Back to races',
} as const;

export function t(key: keyof typeof en): string {
  return en[key];
}
