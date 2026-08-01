import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { Alert } from "react-native";

GoogleSignin.configure({
  webClientId:
    "707099608191-otqbo2ds41tl6dh27rh5i7eeuilullbc.apps.googleusercontent.com",
  offlineAccess: false,
});

export interface GoogleProfile {
  idToken: string;
  email: string;
  firstName: string;
  lastName: string;
}

export function useGoogleAuth(onSuccess: (profile: GoogleProfile) => void) {
  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const { idToken, user } = response.data;
        if (idToken) {
          onSuccess({
            idToken,
            email: user.email ?? "",
            firstName: user.givenName ?? "",
            lastName: user.familyName ?? "",
          });
        } else {
          Alert.alert("Debug", "Nema idToken u odgovoru!");
        }
      } else {
        Alert.alert("Debug", `Response type: ${response.type}`);
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            break;
          case statusCodes.IN_PROGRESS:
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            console.warn("Play Services nisu dostupni");
            Alert.alert("Debug", "Play Services nisu dostupni");
            break;
          default:
            console.error("Google Sign-In error:", error);
            Alert.alert(
              "Debug",
              `Kod: ${error.code}\nPoruka: ${error.message}`,
            );
        }
      } else {
        console.error("Unknown Google Sign-In error:", error);
        Alert.alert("Debug", `Nepoznata greška: ${String(error)}`);
      }
    }
  };

  return { promptAsync: signIn, request: true };
}
