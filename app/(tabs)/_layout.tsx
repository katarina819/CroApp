// app/(tabs)/_layout.tsx
import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Visina navigacijske trake: ikona+label (cca 68px) + system bar inset
  const navBarHeight = 68 + insets.bottom;

  return (
    <View style={styles.container}>
      <Slot />
      <BottomNav />
      {/* Spacer koji gurne sadržaj iznad navigacijske trake */}
      <View style={{ height: navBarHeight }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
});
