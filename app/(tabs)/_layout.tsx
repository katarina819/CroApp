import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";
import BottomNav from "../../components/BottomNav";

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <Slot />
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingBottom: 80, // dovoljno prostora da navigacija ne prekriva sadržaj
  },
});
