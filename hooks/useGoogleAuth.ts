import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

GoogleSignin.configure({
  webClientId:
    "707099608191-otqbo2ds41tl6dh27rh5i7eeuilullbc.apps.googleusercontent.com",
  offlineAccess: false,
});

export function useGoogleAuth(onSuccess: (idToken: string) => void) {
  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (idToken) onSuccess(idToken);
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // korisnik je otkazao, ne treba alert
            break;
          case statusCodes.IN_PROGRESS:
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            console.warn("Play Services nisu dostupni");
            break;
          default:
            console.error("Google Sign-In error:", error);
        }
      } else {
        console.error("Unknown Google Sign-In error:", error);
      }
    }
  };

  return { promptAsync: signIn, request: true };
}
