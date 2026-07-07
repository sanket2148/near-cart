import { StyleSheet, Text, View, FlatList, Pressable, SafeAreaView } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { ArrowLeft, ShoppingBag } from 'lucide-react-native';
import { RootStackParamList, RootStackNavigationProp } from '../navigation/types';
import { useCart } from '@/lib/cart';
import { shops, products } from '@/lib/data';

type ShopDetailsRouteProp = RouteProp<RootStackParamList, 'ShopDetails'>;

export default function ShopDetailsScreen() {
  const route = useRoute<ShopDetailsRouteProp>();
  const navigation = useNavigation<RootStackNavigationProp<'ShopDetails'>>();
  const { shopId } = route.params;

  const { add, qtyOf, setQty, itemCount, subtotal } = useCart();

  // Find shop and products
  const shop = shops.find((s) => s.id === shopId);
  const shopProducts = products.filter((p) => p.shopId === shopId);

  if (!shop) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Shop not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <ArrowLeft size={20} color="#0D1F16" />
        </Pressable>
        <Text style={styles.headerTitle}>{shop.name}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Shop Info Card */}
      <View style={styles.shopInfoCard}>
        <Text style={styles.shopEmoji}>{shop.emoji || '🏪'}</Text>
        <View style={styles.shopMeta}>
          <Text style={styles.shopName}>{shop.name}</Text>
          <Text style={styles.shopTagline}>{shop.tagline || 'Fresh foods and groceries delivered fast.'}</Text>
          <Text style={styles.shopArea}>{shop.area} · {shop.etaMinutes || '20-30'} mins</Text>
        </View>
      </View>

      {/* Menu / Products list */}
      <Text style={styles.menuTitle}>Menu</Text>
      <FlatList
        data={shopProducts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const qty = qtyOf(item.id);
          return (
            <View style={styles.productCard}>
              <Text style={styles.productEmoji}>{item.emoji || '📦'}</Text>
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>₹{item.price} · {item.unit || '1 unit'}</Text>
              </View>

              {qty > 0 ? (
                // Counter control
                <View style={styles.counterContainer}>
                  <Pressable onPress={() => setQty(item.id, qty - 1)} style={styles.counterButton}>
                    <Text style={styles.counterButtonText}>-</Text>
                  </Pressable>
                  <Text style={styles.counterQty}>{qty}</Text>
                  <Pressable onPress={() => setQty(item.id, qty + 1)} style={styles.counterButton}>
                    <Text style={styles.counterButtonText}>+</Text>
                  </Pressable>
                </View>
              ) : (
                // Add button
                <Pressable onPress={() => add(item)} style={styles.addButton}>
                  <Text style={styles.addButtonText}>ADD</Text>
                </Pressable>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.listContainer}
        style={styles.list}
      />

      {/* Floating Bottom Cart Bar */}
      {itemCount > 0 && (
        <Pressable
          onPress={() => navigation.navigate('Cart')}
          style={styles.cartBar}
        >
          <View style={styles.cartBarInfo}>
            <ShoppingBag size={18} color="#FFFFFF" />
            <Text style={styles.cartBarText}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'} · ₹{subtotal}
            </Text>
          </View>
          <Text style={styles.cartBarAction}>View Cart →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1F16',
  },
  placeholder: {
    width: 36,
  },
  shopInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  shopEmoji: {
    fontSize: 36,
    marginRight: 16,
  },
  shopMeta: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1F16',
  },
  shopTagline: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  shopArea: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1F16',
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80, // Space for floating cart bar
    gap: 8,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
  },
  productEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1F16',
  },
  productPrice: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#259F56/10',
    borderWidth: 1,
    borderColor: '#259F56',
  },
  addButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#259F56',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#259F56',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  counterButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  counterQty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 16,
    textAlign: 'center',
  },
  cartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#259F56',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  cartBarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartBarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cartBarAction: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBFCF8',
  },
  errorText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#259F56',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
