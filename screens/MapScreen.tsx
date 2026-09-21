// app/screens/MapScreen.tsx
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import {
  clearPlacesCache,
  getPlacesInRadius,
  Place,
  placeCategories,
} from "../app/services/locationService";

export default function MapScreen() {
  // Stateovi
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // RADIUS STATE
  const [radius, setRadius] = useState(10);
  const [showRadiusModal, setShowRadiusModal] = useState(false);

  // STATE ZA OBAVIJESTI
  const [notification, setNotification] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({ visible: false, message: "", type: "info" });

  // Ref za mapu
  const mapRef = useRef<MapView>(null);
  const notificationTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Opcije za radijus
  const radiusOptions = [
    { label: "50 m", value: 0.05 },
    { label: "100 m", value: 0.1 },
    { label: "500 m", value: 0.5 },
    { label: "1 km", value: 1 },
    { label: "5 km", value: 5 },
    { label: "10 km", value: 10 },
    { label: "20 km", value: 20 },
    { label: "50 km", value: 50 },
    { label: "100 km", value: 100 },
    { label: "150 km", value: 150 },
    { label: "200 km", value: 200 },
  ];

  // FUNKCIJA ZA PRIKAZ OBAVIJESTI
  const showNotification = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    if (notificationTimeout.current) {
      clearTimeout(notificationTimeout.current);
    }
    setNotification({ visible: true, message, type });
    notificationTimeout.current = setTimeout(() => {
      setNotification({ visible: false, message: "", type: "info" });
    }, 3000);
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  // Dohvati lokaciju
  useEffect(() => {
    getUserLocation();
    return () => {
      if (notificationTimeout.current) {
        clearTimeout(notificationTimeout.current);
      }
    };
  }, []);

  const getUserLocation = async () => {
    try {
      setLoading(true);
      setError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Permisija za lokaciju je odbijena");
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
          1000,
        );
      }
    } catch (err) {
      console.error("Error getting location:", err);
      setError("Nemoguće dohvatiti lokaciju");
    } finally {
      setLoading(false);
    }
  };

  // Dohvati mjesta kada se promijene kategorije
  useEffect(() => {
    if (selectedTypes.length > 0 && userLocation) {
      const timeout = setTimeout(() => {
        loadPlaces();
      }, 500);
      return () => clearTimeout(timeout);
    } else {
      setPlaces([]);
    }
  }, [selectedTypes, userLocation]);

  // 🔥 ZASEBNI useEffect ZA RADIJUS
  useEffect(() => {
    if (selectedTypes.length > 0 && userLocation && radius) {
      console.log("📡 Radius changed to:", radius);
      clearPlacesCache();
      loadPlaces();
    }
  }, [radius]);

  const loadPlaces = async () => {
    if (!userLocation) return;
    try {
      setRefreshing(true);
      setNotification({ visible: false, message: "", type: "info" });
      const fetchedPlaces = await getPlacesInRadius(
        userLocation.latitude,
        userLocation.longitude,
        radius,
        selectedTypes as Place["type"][],
      );
      setPlaces(fetchedPlaces);
      const radiusText = radius >= 1 ? `${radius} km` : `${radius * 1000} m`;
      if (fetchedPlaces.length > 0) {
        showNotification(
          `✅ Pronađeno ${fetchedPlaces.length} mjesta u krugu od ${radiusText}`,
          "success",
        );
        if (mapRef.current) {
          fitMarkersToMap(fetchedPlaces);
        }
      } else {
        showNotification(
          `⚠️ Nema pronađenih mjesta u krugu od ${radiusText}`,
          "error",
        );
      }
    } catch (err) {
      console.error("Error loading places:", err);
      showNotification(
        `❌ Greška pri učitavanju mjesta. Provjerite internetsku vezu.`,
        "error",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const fitMarkersToMap = (placesToFit: Place[]) => {
    if (!mapRef.current || placesToFit.length === 0) return;
    const coordinates = placesToFit.map((place) => ({
      latitude: place.latitude,
      longitude: place.longitude,
    }));
    if (userLocation) {
      coordinates.push(userLocation);
    }
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  };

  const getMarkerColor = (type: Place["type"]): string => {
    return placeCategories[type]?.color || "#95A5A6";
  };

  const handleToggleCategory = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  // 🔥 JEDNA handleRadiusSelect FUNKCIJA (uklonjena duplikacija)
  const handleRadiusSelect = (value: number) => {
    console.log("🔄 Setting radius to:", value);
    setRadius(value);
    setShowRadiusModal(false);
  };

  const getRadiusDisplayText = () => {
    if (radius >= 1) {
      return `${radius} km`;
    } else {
      return `${radius * 1000} m`;
    }
  };

  const categoryList = [
    { id: "restaurant", name: "Restorani", icon: "🍽️", color: "#FF6B6B" },
    { id: "cafe", name: "Kafići", icon: "☕", color: "#4ECDC4" },
    { id: "club", name: "Klubovi", icon: "🎵", color: "#9B59B6" },
    { id: "beach", name: "Plaže", icon: "🏖️", color: "#3498DB" },
    { id: "landmark", name: "Znamenitosti", icon: "🏰", color: "#F1C40F" },
    { id: "farm", name: "OPG", icon: "🌾", color: "#2ECC71" },
    { id: "cinema", name: "Kina", icon: "🎬", color: "#E74C3C" },
    { id: "park", name: "Parkovi", icon: "🌳", color: "#27AE60" },
    { id: "museum", name: "Muzeji", icon: "🖼️", color: "#8E44AD" },
    { id: "theater", name: "Kazališta", icon: "🎭", color: "#D35400" },
    { id: "mountain", name: "Planine", icon: "⛰️", color: "#7F8C8D" },
    { id: "nationalPark", name: "Nat. parkovi", icon: "🏞️", color: "#2ECC71" },
    { id: "cave", name: "Špilje", icon: "🕳️", color: "#95A5A6" },
    { id: "spa", name: "Toplice", icon: "💧", color: "#1ABC9C" },
    { id: "paintball", name: "Paintball", icon: "🎯", color: "#E67E22" },
  ];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Dohvaćanje lokacije...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={getUserLocation}>
          <Text style={styles.retryButtonText}>Pokušaj ponovo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
        initialRegion={
          userLocation
            ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : undefined
        }
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{
              latitude: place.latitude,
              longitude: place.longitude,
            }}
            title={place.name}
            description={`${place.type} • ${place.distance?.toFixed(1)} km`}
            pinColor={getMarkerColor(place.type)}
          />
        ))}
      </MapView>

      {/* TOAST OBAVIJEST */}
      {notification.visible && (
        <View
          style={[
            styles.notificationContainer,
            notification.type === "success" && styles.notificationSuccess,
            notification.type === "error" && styles.notificationError,
            notification.type === "info" && styles.notificationInfo,
          ]}
        >
          <Text style={styles.notificationText}>{notification.message}</Text>
        </View>
      )}

      {/* GUMB ZA RADIJUS */}
      <TouchableOpacity
        style={styles.radiusButton}
        onPress={() => setShowRadiusModal(true)}
      >
        <Text style={styles.radiusButtonText}>📏 {getRadiusDisplayText()}</Text>
      </TouchableOpacity>

      {/* Kategorije - horizontalni scroll */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {categoryList.map((cat) => {
            const isSelected = selectedTypes.includes(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => handleToggleCategory(cat.id)}
                style={[
                  styles.categoryChip,
                  { backgroundColor: isSelected ? cat.color : "#fff" },
                ]}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryText,
                    { color: isSelected ? "#fff" : "#333" },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Info bar */}
      {selectedTypes.length > 0 && (
        <View style={styles.infoBar}>
          <Text style={styles.infoText}>
            📍 Pronađeno {places.length} mjesta
          </Text>
          {refreshing && <ActivityIndicator size="small" color="#FFF" />}
        </View>
      )}

      {/* Gumb za centriranje */}
      <TouchableOpacity
        style={styles.centerButton}
        onPress={() => {
          if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              },
              500,
            );
          }
        }}
      >
        <Text style={styles.centerButtonText}>📍</Text>
      </TouchableOpacity>

      {/* MODAL ZA ODABIR RADIJUSA */}
      <Modal
        visible={showRadiusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRadiusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Odaberite radijus pretrage</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {radiusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.radiusOption,
                    radius === option.value && styles.radiusOptionSelected,
                  ]}
                  onPress={() => handleRadiusSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.radiusOptionText,
                      radius === option.value &&
                        styles.radiusOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowRadiusModal(false)}
            >
              <Text style={styles.modalCloseText}>Zatvori</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// STILOVI (isti kao prije)
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  categoriesContainer: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
  },
  scrollContent: { gap: 8, paddingRight: 10 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryIcon: { fontSize: 18 },
  categoryText: { fontSize: 13, fontWeight: "600" },
  radiusButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  radiusButtonText: { fontSize: 14, fontWeight: "600", color: "#333" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    width: "80%",
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
    color: "#333",
  },
  radiusOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  radiusOptionSelected: { backgroundColor: "#4ECDC4", borderRadius: 8 },
  radiusOptionText: { fontSize: 16, textAlign: "center", color: "#333" },
  radiusOptionTextSelected: { color: "#FFF", fontWeight: "600" },
  modalCloseButton: {
    marginTop: 15,
    paddingVertical: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  modalCloseText: {
    textAlign: "center",
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  infoBar: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  centerButton: {
    position: "absolute",
    bottom: 80,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  centerButtonText: { fontSize: 24 },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  loadingText: { marginTop: 10, fontSize: 16, color: "#666" },
  errorText: {
    fontSize: 16,
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: "#4ECDC4",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  notificationContainer: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#333",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  notificationSuccess: { backgroundColor: "#4CAF50" },
  notificationError: { backgroundColor: "#F44336" },
  notificationInfo: { backgroundColor: "#2196F3" },
  notificationText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
