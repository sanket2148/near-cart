import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, TextInput, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MapPin, Search, ChevronRight } from 'lucide-react-native';
import { HomeTabNavigationProp } from '../navigation/types';
import { getShops, getCategories } from '../lib/catalog';
import type { Shop, Category } from '@/lib/data';

const categoryEmojis: Record<string, string> = {
  grocery: '🛒',
  pharmacy: '💊',
  bakery: '🥐',
  hardware: '🔌',
  stationery: '✏️',
  electronics: '🔌',
};

export default function HomeScreen() {
  const navigation = useNavigation<HomeTabNavigationProp<'Home'>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [shopRows, categoryRows] = await Promise.all([getShops(), getCategories()]);
      setShops(shopRows);
      setCategories(categoryRows);
    } catch (err) {
      console.warn('Failed to load catalog:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Filter shops based on search query and active category
  const filteredShops = shops.filter((shop) => {
    const matchesSearch = shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          shop.area.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || shop.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color="#259F56" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Profile & Location */}
      <View style={styles.header}>
        <View style={styles.locationContainer}>
          <MapPin size={18} color="#259F56" />
          <Text style={styles.locationText}>Koramangala, Bengaluru</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>SK</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Search size={16} color="#64748B" style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search for restaurants, grocery, medicine..."
          style={styles.searchInput}
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Categories Horizontal Scroll */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
          <Pressable
            onPress={() => setActiveCategory(null)}
            style={[
              styles.categoryChip,
              activeCategory === null && styles.categoryChipActive
            ]}
          >
            <Text style={[styles.categoryText, activeCategory === null && styles.categoryTextActive]}>
              🔥 All
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[
                styles.categoryChip,
                activeCategory === cat.id && styles.categoryChipActive
              ]}
            >
              <Text style={[styles.categoryText, activeCategory === cat.id && styles.categoryTextActive]}>
                {categoryEmojis[cat.id] || '🛍️'} {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Section Header */}
      <Text style={styles.sectionTitle}>Shops Near You</Text>

      {/* Shops List */}
      <FlatList
        data={filteredShops}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ShopDetails', { shopId: item.id })}
            style={styles.shopCard}
          >
            <Text style={styles.shopEmoji}>{item.emoji || '🏪'}</Text>
            <View style={styles.shopDetails}>
              <View style={styles.shopHeader}>
                <Text style={styles.shopName}>{item.name}</Text>
                {item.rating ? (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>⭐ {item.rating}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.shopTagline}>{item.tagline || 'Local Hyperlocal Store'}</Text>
              <Text style={styles.shopArea}>{item.area} · {item.etaMinutes || '20-30'} mins</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" style={styles.chevron} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No shops found in this category.</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#259F56" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
    paddingTop: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1F16',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#259F56',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0D1F16',
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#259F56/10',
    borderColor: '#259F56',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTextActive: {
    color: '#259F56',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1F16',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  shopEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  shopDetails: {
    flex: 1,
  },
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 8,
  },
  shopName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D1F16',
  },
  ratingBadge: {
    backgroundColor: '#F3821D/10',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F3821D',
  },
  shopTagline: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  shopArea: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  chevron: {
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
