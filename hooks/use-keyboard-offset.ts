import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Stvarna visina tipkovnice, u pikselima (0 kad je zatvorena).
 *
 * Zašto se mjeri ručno umjesto da se koristi `KeyboardAvoidingView`:
 * unutar `<Modal>`-a na Androidu tipkovnica NE pomiče sadržaj — modal je
 * zaseban prozor koji ne nasljeđuje "adjustResize" postavku aplikacije, pa se
 * `KeyboardAvoidingView` (koji se na Androidu oslanja upravo na to) nema na što
 * osloniti i polje za unos ostane skriveno ispod tipkovnice.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) =>
      setHeight(e.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}

/**
 * Razmak koji redak s unosom mora ostaviti pri dnu ekrana.
 *
 * Aplikacija radi u "edge-to-edge" načinu (app.json), dakle crta ispod
 * sistemskih traka. U tom načinu visina koju tipkovnica prijavi ne pokriva i
 * pojas trake za navigaciju gestama, pa je odmak samo za visinu tipkovnice
 * taman premali — polje ostaje vidljivo tek rubom. Zato se sigurnosni razmak
 * (insets.bottom) dodaje i kad je tipkovnica otvorena, plus mali vizualni
 * odmak da polje ne bude zalijepljeno uz tipkovnicu.
 */
export function useInputBottomOffset(): number {
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();

  return keyboardHeight > 0
    ? keyboardHeight + insets.bottom + 8
    : insets.bottom;
}
