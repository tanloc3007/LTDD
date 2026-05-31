export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '769715173800-apeqnirv8pi0c26j709o0d973tim15on.apps.googleusercontent.com';

export const GOOGLE_ANDROID_PACKAGE = 'com.student.financialmanagement';
export const GOOGLE_RELEASE_SHA1 = '3A:D2:31:6F:44:B1:26:AF:F9:CE:B0:E9:A4:91:56:70:8F:64:76:52';

export function getGoogleDeveloperErrorMessage() {
  return [
    'Google Sign-In chua duoc cau hinh dung cho APK release.',
    `Package name: ${GOOGLE_ANDROID_PACKAGE}`,
    `SHA-1 release: ${GOOGLE_RELEASE_SHA1}`,
    'Hay them Android OAuth Client voi package va SHA-1 nay trong Google Cloud Console hoac Firebase, cung project voi Web Client ID dang dung.',
  ].join('\n\n');
}
