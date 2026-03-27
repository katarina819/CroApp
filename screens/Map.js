import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function Map({ locations = [], center, zoom = 7 }) {
  if (!center) {
    return (
      <View style={styles.center}>
        <Text>Nema podataka za mapu</Text>
      </View>
    );
  }

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: 5,
        longitudeDelta: 5,
      }}
    >
      {locations.map((loc, index) => (
        <Marker
          key={index}
          coordinate={{
            latitude: loc.lat,
            longitude: loc.lng,
          }}
          title={`Lokacija ${index + 1}`}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});