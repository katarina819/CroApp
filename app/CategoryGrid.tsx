// app/CategoryGrid.tsx
import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity
} from "react-native";

interface CategoryGridProps {
  selectedTypes: string[];
  onToggleCategory: (type: string) => void;
}

const categories = [
  { id: "restaurant", name: "Restoran", icon: "🍽️", color: "#FF6B6B" },
  { id: "cafe", name: "Kafić", icon: "☕", color: "#4ECDC4" },
  { id: "club", name: "Noćni klub", icon: "🎵", color: "#9B59B6" },
  { id: "beach", name: "Plaža", icon: "🏖️", color: "#3498DB" },
  { id: "landmark", name: "Znamenitost", icon: "🏰", color: "#F1C40F" },
  { id: "farm", name: "OPG", icon: "🌾", color: "#2ECC71" },
  { id: "cinema", name: "Kino", icon: "🎬", color: "#E74C3C" },
  { id: "park", name: "Park", icon: "🌳", color: "#27AE60" },
  { id: "museum", name: "Muzej", icon: "🖼️", color: "#8E44AD" },
  { id: "theater", name: "Kazalište", icon: "🎭", color: "#D35400" },
  { id: "mountain", name: "Planina", icon: "⛰️", color: "#7F8C8D" },
  { id: "nationalPark", name: "Nat. park", icon: "🏞️", color: "#2ECC71" },
  { id: "cave", name: "Špilja", icon: "🕳️", color: "#95A5A6" },
  { id: "spa", name: "Toplice", icon: "💧", color: "#1ABC9C" },
  { id: "paintball", name: "Paintball", icon: "🎯", color: "#E67E22" },
];

export default function CategoryGrid({
  selectedTypes,
  onToggleCategory,
}: CategoryGridProps) {
  const renderItem = ({ item }: { item: any }) => {
    const isSelected = selectedTypes.includes(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          { backgroundColor: isSelected ? item.color : "#F5F5F5" },
        ]}
        onPress={() => onToggleCategory(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.categoryIcon}>{item.icon}</Text>
        <Text
          style={[styles.categoryName, { color: isSelected ? "#FFF" : "#333" }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={categories}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={3}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={true}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryItem: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#F5F5F5",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
});
